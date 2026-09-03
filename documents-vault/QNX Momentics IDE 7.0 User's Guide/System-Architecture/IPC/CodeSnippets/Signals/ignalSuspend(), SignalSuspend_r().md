---
title: "ignalSuspend(), SignalSuspend_r()"
category: "IPC"
source: "https://www.qnx.com/developers/docs/7.0.0/"
tags: [qnx, ipc, message-passing]
---

# ignalSuspend(), SignalSuspend_r()
Suspend a thread until a signal is received_

## Synopsis:

```c
#include <sys/neutrino.h>

int SignalSuspend( const sigset_t* set );

int SignalSuspend_r( const sigset_t* set );
```

## Arguments:

**set** —

A pointer to a sigset_t object that specifies the signals you want to wait for.

## Library:

libc

Use the -l c option to [qcc](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.utilities/topic/q/qcc.html) to link against this library. This library is usually included automatically.

## Description:

These kernel calls replace the thread's signal mask with the set of signals pointed to by set and then suspends the thread until delivery of a signal whose action is either to execute a signal-catching function (then return), or to terminate the thread. On return, the previous signal mask is restored.

The SignalSuspend() and SignalSuspend_r() functions are identical, except in the way they indicate errors. See the [Returns](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/s/signalsuspend.html#signalsuspend__Returns) section for details.

Instead of using these kernel calls directly, consider calling [sigsuspend()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/s/sigsuspend.html "Replace the signal mask, and then suspend the thread").

Attempts to block SIGKILL or SIGSTOP are ignored. This is done without causing an error.

If you're using SignalSuspend() to synchronously wait for a signal, consider using the more efficient POSIX [sigwaitinfo()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/s/sigwaitinfo.html "Wait for a specified signal and return its information") call.

**Blocking states**

STATE_SIGSUSPEND

The calling thread blocks waiting for a signal.

## Returns:

Since SignalSuspend() and SignalSuspend_r() block until interrupted, there's no successful return value:

- SignalSuspend() always returns -1 and sets [errno](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/e/errno.html "Thread-local error variable").
- SignalSuspend_r() always returns a value in the Errors section and **doesn't** set errno.

If the signal handler calls [longjmp()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/l/longjmp.html "Restore the environment saved by setjmp()") or [siglongjmp()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/s/siglongjmp.html "Restore the environment saved by sigsetjmp(), including the signal mask"), SignalSuspend() and SignalSuspend_r() don't return.

## Errors:

### `EINTR`

The call was interrupted by a signal (this is the normal error).

### `EFAULT`

A fault occurred when the kernel tried to access the buffers provided.

### `ETIMEDOUT`

A kernel timeout unblocked the call. See [TimerTimeout()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/t/timertimeout.html "Set a timeout on a blocking state").

## Classification:

[QNX Neutrino](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/summary.html#summary__CLASSIFICATION)

> [!info] Safety — Classification
>
> | Safety | Value |
> |---|---|
> |Cancellation point|Yes|
> |Interrupt handler|No|
> |Signal handler|Yes|
> |Thread|Yes|

### Related reference  

[SignalKill(), SignalKill_r()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/s/signalkill.html "Send a signal to a process group, process, or thread")

[SignalKillSigval(), SignalKillSigval_r()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/s/signalkillsigval.html "Send a signal to a process group, process, or thread")

[sigsuspend()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/s/sigsuspend.html "Replace the signal mask, and then suspend the thread")
