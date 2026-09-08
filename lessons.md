## Test Isolation Issue: Parallel Database Tests

### Problem

After splitting the session tests into separate files (`create.test.js` and `get.test.js`), some tests began failing even though the API implementation was working correctly.

The failures included:

* `C7: stores the created session in the database` returning zero rows.
* GET tests returning `404` immediately after successfully creating a session.

### Root Cause

Both test files use a shared PostgreSQL database and contain:

```js
beforeEach(async () => {
  await pool.query('DELETE FROM training_sessions');
});
```

Vitest runs test files in parallel by default. This meant one test file could execute its cleanup query while another test was using the same database.

For example:

```text
create.test.js              get.test.js
     │                           │
     │ Create session             
     │                           │
     │                       DELETE sessions
     │                           │
     │ Query created session      │
     └───────────────►        session no longer exists
```

The result was a race condition between test suites.

### Solution

Vitest was configured to disable file-level parallelism:

```js
test: {
  fileParallelism: false
}
```

This ensures the database integration test files execute sequentially while each individual test can still use its existing `beforeEach` cleanup.

### Key Lesson

When integration tests share mutable external state such as a database, parallel test execution can introduce race conditions and produce misleading failures. Test isolation must account not only for individual tests, but also for interactions between test suites.
