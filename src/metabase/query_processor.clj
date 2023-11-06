(ns metabase.query-processor
  "Primary entrypoints to running Metabase (MBQL) queries.

    (metabase.query-processor/process-query {:type :query, :database 1, :query {:source-table 2}})

  Various REST API endpoints, such as `POST /api/dataset`, return the results of queries; they usually
  use [[userland-query]] or [[userland-query-with-default-constraints]] (see below)."
  (:refer-clojure :exclude [compile])
  (:require
   [metabase.config :as config]
   [metabase.mbql.schema :as mbql.s]
   [metabase.plugins.classloader :as classloader]
   [metabase.query-processor.compile :as qp.compile]
   [metabase.query-processor.context :as qp.context]
   [metabase.query-processor.execute :as qp.execute]
   [metabase.query-processor.middleware.catch-exceptions :as catch-exceptions]
   [metabase.query-processor.middleware.enterprise :as qp.middleware.enterprise]
   [metabase.query-processor.middleware.fetch-source-query :as fetch-source-query]
   [metabase.query-processor.middleware.normalize-query :as normalize]
   [metabase.query-processor.middleware.process-userland-query :as process-userland-query]
   [metabase.query-processor.postprocess :as qp.postprocess]
   [metabase.query-processor.preprocess :as qp.preprocess]
   [metabase.query-processor.reducible :as qp.reducible]
   [metabase.query-processor.setup :as qp.setup]
   [metabase.util.log :as log]
   [metabase.util.malli :as mu]
   [metabase.async.util :as async.u]))

;;; This is a namespace that adds middleware to test MLv2 stuff every time we run a query. It lives in a `./test`
;;; namespace, so it's only around when running with `:dev` or the like.
;;;
;;; Why not just do `classloader/require` in a `try-catch` and ignore exceptions? Because we want to know if this errors
;;; for some reason. If we accidentally break the namespace and just ignore exceptions, we could be skipping our tests
;;; without even knowing about it. So it's better to have this actually error if in cases where it SHOULD be working.
(when config/tests-available?
  (classloader/require 'metabase.query-processor-test.test-mlv2))

(def around-middleware
  "Middleware that goes AROUND *all* the other middleware (even for pre-processing only or compilation only). Has the
  form

    (f qp) -> qp

  Where `qp` has the form

    (f query rff context)"
  ;; think of the direction stuff happens in as if you were throwing a ball up in the air; as the query-ball goes up the
  ;; around middleware pre-processing stuff happens; then the query is executed, as the "ball of results" comes back
  ;; down any post-processing these around middlewares might do happens in reversed order.
  ;;
  ;; ↓↓↓ POST-PROCESSING ↓↓↓ happens from TOP TO BOTTOM
  [#'fetch-source-query/resolve-card-id-source-tables
   ;; `normalize` has to be done at the very beginning or `resolve-card-id-source-tables` and the like might not work.
   ;; It doesn't really need to be 'around' middleware tho.
   (resolve 'metabase.query-processor-test.test-mlv2/around-middleware)
   #'qp.middleware.enterprise/handle-audit-app-internal-queries-middleware
   ;; userland queries only: save a QueryExecution
   #'process-userland-query/save-query-execution-and-add-running-time
   #'normalize/normalize-around-middleware
   ;; userland queries only: catch Exceptions and return a special error response
   #'catch-exceptions/catch-exceptions])
;; ↑↑↑ PRE-PROCESSING ↑↑↑ happens from BOTTOM TO TOP

(defn- process-query** [query rff context]
  (let [preprocessed (qp.preprocess/preprocess query)
        compiled     (qp.compile/compile-preprocessed preprocessed)
        rff          (qp.postprocess/post-processing-rff preprocessed rff)]
    (qp.execute/execute compiled rff context)))

(def ^:private ^{:arglists '([query rff context])} process-query* nil)

(defn- rebuild-process-query-fn! []
  (alter-var-root #'process-query* (constantly
                                    (reduce
                                     (fn [qp middleware]
                                       (middleware qp))
                                     process-query**
                                     around-middleware))))

(rebuild-process-query-fn!)

(doseq [varr  around-middleware
        :when varr]
  (add-watch varr ::reload (fn [_key _ref _old-state _new-state]
                             (log/infof "%s changed, rebuilding %s" varr `process-query*)
                             (rebuild-process-query-fn!))))

(mu/defn process-query :- [:fn {:error/message "process-query unexpectedly returned nil."} some?]
  "Process an MBQL query. This is the main entrypoint to the magical realm of the Query Processor. What this returns
  depends on the `context`:

  * A synchronous context will return results in the standard map format with `:status`, `:data`, etc. This is the
    default context used if `context` is not explicitly specified.

  * An async context will return a core.async promise channel. If this core.async channel is closed at any time before
    the query finishes running, the query will be canceled.

  * Some other contexts like those used in streaming API endpoints or CSV/XLSX/JSON downloads might return something
    different... refer to those usages for more information."
  ([query]
   (process-query query nil nil))

  ([query context]
   (process-query query nil context))

  ([query   :- :map
    rff     :- [:maybe ::qp.context/rff]
    context :- [:maybe ::qp.context/context]]
   (when (contains? query :async?)
     (log/warn ":async? as an query option is deprecated and ignored; pass an explicit async context."))
   (qp.setup/with-qp-setup [query query]
     (let [rff     (or rff qp.reducible/default-rff)
           context (or context (qp.context/sync-context))]
       (try
         (process-query* query rff context)
         (catch Throwable e
           (qp.context/raisef e context)))))))

(mu/defn userland-query :- :map
  "Add middleware options and `:info` to a `query` so it is ran as a 'userland' query, which slightly changes the QP
  behavior:

  1. Exceptions are caught, and a special error shape is returned (see [[catch-exceptions/catch-exceptions]])

  2. A `QueryExecution` is saved in the application database (see
     [[process-userland-query/save-query-execution-and-add-running-time]])

  3. A few extra keys like `:running_time` and `:started_at` are added to the QP
     response (see [[process-userland-query/save-query-execution-and-add-running-time]])"
  ([query]
   (userland-query query nil))

  ([query :- :map
    info  :- [:maybe mbql.s/Info]]
   (-> query
       (assoc-in [:middleware :userland-query?] true)
       (update :info merge info))))

(mu/defn userland-query-with-default-constraints :- :map
  "Add middleware options and `:info` to a `query` so it is ran as a 'userland' query. QP behavior changes are the same
  as those for [[userland-query]], *plus* the default userland constraints (limits) are applied --
  see [[qp.constraints/add-default-userland-constraints]].

  This ultimately powers most of the REST API entrypoints into the QP."
  ([query]
   (userland-query-with-default-constraints query nil))

  ([query :- :map
    info  :- [:maybe mbql.s/Info]]
   (-> query
       (userland-query info)
       (assoc-in [:middleware :add-default-userland-constraints?] true))))

;;;; DEPRECATED

(defn ^:deprecated compile
  "DEPRECATED: use [[qp.compile/compile]] instead."
  [query]
  (:native (qp.compile/compile query)))
