---
title: "SignalKill(), SignalKill_r()"
category: "IPC"
source: "https://www.qnx.com/developers/docs/7.0.0/"
tags: [qnx, ipc, message-passing]
---

# SignalKill(), SignalKill_r()
_Send a signal to a process group, process, or thread_

## Synopsis:

```c
#include <sys/neutrino.h>

int SignalKill( uint32_t nd,
                pid_t pid,
                int tid,
                int signo,
                int code,
                int value );

int SignalKill_r( uint32_t nd,
                  pid_t pid,
                  int tid,
                  int signo,
                  int code,
                  int value );
```

## Arguments:

**nd** —

The node descriptor of the node on which to look for pid and tid. To search the local node, set nd to ND_LOCAL_NODE or 0.

**pid** —

0, or the ID of the process to send the signal to; see below.

**tid** —

0, or the ID of the thread to send the signal to; see below.

**signo** —

The signal that you want to send. There are a total of 64 signals available. Of these, at least 8 are POSIX realtime signals that range from SIGRTMIN to SIGRTMAX. For a complete list of signals, see “[POSIX and QNX Neutrino signals](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/s/signalaction.html#signalaction__POSIXSignals)” in the documentation for SignalAction(). Valid user signals range from 1 to (NSIG - 1).

You can OR the SIG_APPID flag into the signo argument. This tells SignalKill() to send the signal to all the processes with an application ID that matches the pid argument.

If the signal terminates a process, the cleanup of the terminated process occurs by default at the priority of the thread that sent the signal. If you OR the SIG_TERMER_NOINHERIT flag (defined in <signal.h>) into signo, the cleanup occurs at the priority of the thread that received the signal.

**code, value** —

The code and value that you want to send with the signal; see [siginfo_t](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/s/siginfo_t.html "Information about a signal").

## Library:

libc

Use the -l c option to [qcc](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.utilities/topic/q/qcc.html) to link against this library. This library is usually included automatically.

## Description:

The SignalKill() and SignalKill_r() kernel calls send the signal signo with a code specified by code and a value specified by value to a process group, process, or thread.

In order to send signals to a process with a different real or effective user ID, your process must have the PROCMGR_AID_SIGNAL ability enabled. For more information, see [procmgr_ability()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/procmgr_ability.html "Control a process's ability to perform certain operations").

These functions are identical except in the way they indicate errors. See the [Returns](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/s/signalkill.html#signalkill__Returns) section for details.

If signo is zero, no signal is sent, but the validity of pid and tid are checked. You can use this as a test for existence.

SignalKill() implements the capabilities of the POSIX functions [kill()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/k/kill.html "Send a signal to a process or a group of processes"), [sigqueue()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/s/sigqueue.html "Queue a signal to a process"), and [pthread_kill()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_kill.html "Send a signal to a thread") in one call. Consider using these functions instead of invoking these kernel calls directly.

The pid and tid determine the target of the signal, as follows:

|pid|tid|target|
|---|---|---|
|= 0|—|Hit the process group of the caller|
|< 0|—|Hit a process group identified by -pid|
|> 0|= 0|Hit a single process identified by pid|
|> 0, and you've ORed SIG_APPID into the signo argument|—|Hit all processes with the application ID identified by pid|
|> 0|> 0|Hit a single thread in process pid identified by tid|

If the target is a thread, the signal is always delivered to exactly that thread. If the thread has the signal blocked—see [SignalProcmask()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/s/signalprocmask.html "Modify or examine a thread's signal-blocked mask")—the signal remains pending on the thread.

If the target is a process, the signal is delivered to a thread that has the signal unblocked; see SignalProcmask(), [SignalSuspend()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/s/signalsuspend.html "Suspend a thread until a signal is received"), and [SignalWaitinfo()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/s/signalwaitinfo.html "Select a pending signal"). If multiple threads have the signal unblocked, only one thread is given the signal. Which thread receives the signal isn't deterministic. To make it deterministic, you can:

- Have all threads except one block all signals; that thread handles all signals.
    
    Or:
    
- Target the signals to specific threads.

If all threads have the signal blocked, it's made pending on the process. The first thread to unblock the signal receives the pending signal. If a signal is pending on a thread, it's never retargetted to the process or another thread, regardless of changes to the signal-blocked mask.

If the target is a process group, the signal is delivered as above to each process in the group.

A multithreaded application typically has one thread responsible for catching most or all signals. Threads that don't wish to be directly involved with signals block all signals in their mask.

The signal-blocked mask is maintained on a per-thread basis. The signal-ignore mask and signal handlers are maintained at the process level and are shared by all threads.

If multiple signals are delivered before the target can run and process the signals, the system queues them in priority order if the SA_SIGINFO bit was set for signo. Lower numbered signals have greater priority. If the SA_SIGINFO bit isn't set for signo, then at most one signal is queued at any time. Additional signals with the same signo replace existing ones. This is the default behavior for POSIX signal handlers installed using the old [signal()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/s/signal.html "Set handling for exceptional conditions") function. The newer [sigaction()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/s/sigaction.html "Examine or specify the action associated with a signal") function lets you control queuing or not on a per-signal basis. Signals with a code of SI_TIMER are never queued.

The code and value are always saved with the signal. This allows you to deliver data with the signal whether or not SA_SIGINFO has been set on the signo. If SA_SIGINFO is set, you can use signals to deliver small amounts of data without loss. If you wish to pass significant data, you may wish to consider using [MsgSendPulse()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/msgsendpulse.html "Send a pulse to a process") and [MsgSendv()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/msgsendv.html "Send a message to a channel"), which deliver data with much greater efficiency.

When a thread receives a signal by a signal handler or SignalWaitinfo() call, it can retrieve the signo, code and value from a [siginfo_t](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/s/siginfo_t.html "Information about a signal") structure, which contains at least the following members:

int si_signo

The signal number.

int si_code

The signal code.

union sigval si_value

The signal value.

The value of si_code is limited to an 8-bit signed value as follows:

|Value|Description|
|---|---|
|-128 <= si_code <= 0|User values|
|0 < signo <= 127|System values generated by the kernel|

Some of the common user values defined by POSIX are:

- SI_USER — the [kill()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/k/kill.html "Send a signal to a process or a group of processes") function generated the signal.
- SI_QUEUE — the [sigqueue()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/s/sigqueue.html "Queue a signal to a process") function generated the signal.
- SI_TIMER — a timer generated the signal.
- SI_ASYNCIO — asynchronous I/O generated the signal.
- SI_MESGQ — POSIX (not QNX Neutrino) message queues generated the signal.

A successful return from this function means the signal has been delivered. What the process(es) or thread does with the signal isn't considered.

If the signal terminates a process, the cleanup of the terminated process occurs at the priority of the thread that sent the signal.

If a thread delivers signals that the receiving process has marked as queued faster than the receiver can consume them, the kernel may fail the call if it runs out of signal queue entries. If the signo, code, and value don't change, the kernel performs signal compression by saving an 8-bit count with each queued signal.

**Blocking states**

None for the local case. In the network case:

STATE_NET_SEND or STATE_NET_REPLY

The calling thread is blocked while the signal is delivered to the local Qnet manager, which transmits it to the remote Qnet. The remote Qnet does a SignalKill() on behalf of the caller, and the return value is transmitted back, at which point the calling thread is unblocked.

## Returns:

The only difference between these functions is the way they indicate errors:

SignalKill()

If an error occurs, -1 is returned and sets [errno](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/e/errno.html "Thread-local error variable"). Any other value returned indicates success.

SignalKill_r()

EOK is returned on success. This function does **NOT** set errno. If an error occurs, any value in the Errors section may be returned.

## Errors:

### `EAGAIN`

The kernel had insufficient resources to enqueue the signal.

### `EINVAL`

The value of signo is less than 0 or greater than (_NSIG -1).

### `ENOREMOTE`

The node descriptor is for a remote node, but the network manager isn't running.

### `EPERM`

The calling process doesn't have the required permission; see [procmgr_ability()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/procmgr_ability.html "Control a process's ability to perform certain operations").

### `ESRCH`

The process or process group indicated by pid or thread indicated by tid doesn't exist.

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

### Related concepts  

[Process termination (QNX Neutrino Programmer's Guide)](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.prog/topic/process_PROCTERM.html "Process termination (QNX Neutrino Programmer's Guide)")

### Related reference  

[procmgr_ability()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/procmgr_ability.html "Control a process's ability to perform certain operations")

[pthread_kill()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_kill.html "Send a signal to a thread")

[kill()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/k/kill.html "Send a signal to a process or a group of processes")

[siginfo_t](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/s/siginfo_t.html "Information about a signal")

[SignalAction(), SignalAction_r()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/s/signalaction.html "Examine and/or specify actions for signals")

[SignalKillSigval(), SignalKillSigval_r()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/s/signalkillsigval.html "Send a signal to a process group, process, or thread")

[SignalProcmask(), SignalProcmask_r()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/s/signalprocmask.html "Modify or examine a thread's signal-blocked mask")

[SignalSuspend(), SignalSuspend_r()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/s/signalsuspend.html "Suspend a thread until a signal is received")

[SignalWaitinfo(), SignalWaitinfo_r()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/s/signalwaitinfo.html "Select a pending signal")

[SignalWaitinfoMask(), SignalWaitinfoMask_r()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/s/signalwaitinfomask.html "Block a set of signals and then select a pending signal")

[sigqueue()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/s/sigqueue.html "Queue a signal to a process")
