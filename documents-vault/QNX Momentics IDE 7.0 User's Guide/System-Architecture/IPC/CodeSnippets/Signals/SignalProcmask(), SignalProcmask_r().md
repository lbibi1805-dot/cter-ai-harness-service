---
title: "SignalProcmask(), SignalProcmask_r()"
category: "IPC"
source: "https://www.qnx.com/developers/docs/7.0.0/"
tags: [qnx, ipc, message-passing]
---

# SignalProcmask(), SignalProcmask_r()
_Modify or examine a thread's signal-blocked mask_

## Synopsis:

```c
#include <sys/neutrino.h>

int SignalProcmask( pid_t pid,
                    int tid,
                    int how,
                    const sigset_t* set,
                    sigset_t* oldset );

int SignalProcmask_r( pid_t pid,
                      int tid,
                      int how,
                      const sigset_t* set,
                      sigset_t* oldset );
```

## Arguments:

**pid** —

0, or a process ID; see below.

**tid** —

0, or a thread ID; see below.

**how** —

The manner in which you want to change the set; one of:

- SIG_BLOCK — the resulting set is the union of the current set and the signal set pointed to by set.
- SIG_UNBLOCK — the resulting set is the intersection of the current set and the signal set pointed to by set.
- SIG_SETMASK — the resulting set is the signal set pointed to by set.

As a special case, you can use the how argument to query the current set of pending signals:

- SIG_PENDING — save the combined set of pending signals on the thread and process in the signal set pointed to by oldset. The set argument is ignored.

**set** —

NULL, or a pointer to a sigset_t object that specifies the set of signals to be used to change the currently blocked set.

**oldset** —

NULL, or a pointer to a sigset_t object where the function can store the previous blocked mask.

You can use various combinations of set and oldset to query or change (or both) the signal-blocked mask for a signal.

## Library:

libc

Use the -l c option to [qcc](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.utilities/topic/q/qcc.html) to link against this library. This library is usually included automatically.

## Description:

These kernel calls modify or examine the signal-blocked mask of the thread tid in process pid. If pid is zero, the current process is assumed. If tid is zero, pid is ignored and the calling thread is used.

The SignalProcmask() and SignalProcmask_r() functions are identical, except in the way they indicate errors. See the [Returns](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/s/signalprocmask.html#signalprocmask__Returns) section for details.

- Instead of using these kernel calls directly, consider calling [pthread_sigmask()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_sigmask.html "Modify or examine a thread's signal-blocked mask").
- In order to set the signal-blocked mask for a process with a different real or effective user ID, your process must have the PROCMGR_AID_SIGNAL ability enabled. For more information, see [procmgr_ability()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/procmgr_ability.html "Control a process's ability to perform certain operations").

When a signal is unmasked, the kernel checks for pending signals on the thread and, if there aren't any pending, checks for pending signals on the process:

|Check|Action|
|---|---|
|Signal pending on thread|The signal is immediately acted upon|
|Signal pending on process|The signal is moved to the thread and is immediately acted upon|
|No signal pending|No signal action performed until delivery of an unblocked signal|

It isn't possible to block the SIGCONT, SIGKILL, or SIGSTOP signals. It also isn't possible to unmask the special QNX Neutrino signals (SIGSELECT and the unnamed ones).

When a signal handler is invoked, the signal responsible is automatically masked before its handler is called; see [SignalAction()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/s/signalaction.html "Examine and/or specify actions for signals"). If the handler returns normally, the operating system restores the signal mask present just before the handler was called as an atomic operation. Changes made using SignalProcmask() in the handler are undone.

When a signal is targeted at a process, the kernel delivers it to at most one thread (see [SignalKill()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/s/signalkill.html "Send a signal to a process group, process, or thread")) that has the signal unblocked. If multiple threads have the signal unblocked, only one thread is given the signal. Which thread receives the signal isn't deterministic. To make it deterministic, you can:

- Have all threads except one block all signals; that thread handles all signals.
    
    Or:
    
- Target signals to specific threads.

If all threads have the signal blocked, it's made pending on the process. The first thread to unblock the signal receives the pending signal. If a signal is pending on a thread, it's never retargetted to the process or another thread, regardless of changes to the signal-blocked mask.

Signals targeted at a thread always affect that thread alone.

**Blocking states**

These calls don't block.

## Returns:

The only difference between these functions is the way they indicate errors:

SignalProcmask()

If an error occurs, -1 is returned and [errno](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/e/errno.html "Thread-local error variable") is set. Any other value returned indicates success.

SignalProcmask_r()

EOK is returned on success. This function does **NOT** set errno. If an error occurs, any value in the Errors section may be returned.

## Errors:

### `EAGAIN`

The system was unable to allocate a signal handler. This indicates critically low memory.

### `EFAULT`

A fault occurred when the kernel tried to access the buffers provided.

### `EINVAL`

The value of how is invalid, or you tried to set SIGKILL or SIGSTOP to something other than SIG_DFL.

### `EPERM`

The calling process doesn't have the required permission; see [procmgr_ability()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/procmgr_ability.html "Control a process's ability to perform certain operations").

### `ESRCH`

The process indicated by pid or thread indicated by tid doesn't exist.

## Classification:

[QNX Neutrino](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/summary.html#summary__CLASSIFICATION)

> [!info] Safety — Classification
>
> | Safety | Value |
> |---|---|
> |Cancellation point|No|
> |Interrupt handler|No|
> |Signal handler|Yes|
> |Thread|Yes|

### Related reference  

[procmgr_ability()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/procmgr_ability.html "Control a process's ability to perform certain operations")

[pthread_sigmask()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_sigmask.html "Modify or examine a thread's signal-blocked mask")

[SignalAction(), SignalAction_r()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/s/signalaction.html "Examine and/or specify actions for signals")

[SignalKill(), SignalKill_r()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/s/signalkill.html "Send a signal to a process group, process, or thread")

[SignalKillSigval(), SignalKillSigval_r()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/s/signalkillsigval.html "Send a signal to a process group, process, or thread")
