---
title: "SignalAction(), SignalAction_r()"
category: "IPC"
source: "https://www.qnx.com/developers/docs/7.0.0/"
tags: [qnx, ipc, message-passing]
---

# SignalAction(), SignalAction_r()
_Examine and/or specify actions for signals_

## Synopsis:

```c
#include <sys/neutrino.h>

int SignalAction( pid_t pid,
                  void (*sigstub)(void),
                  int signo,
                  const struct sigaction *act,
                  struct sigaction *oact );

int SignalAction_r( pid_t pid,
                    void (*sigstub)(void),
                    int signo,
                    const struct sigaction *act,
                    struct sigaction *oact );
```

## Arguments:

**pid** —

A process ID, or 0 for the current process.

**sigstub** —

The address of a signal stub handler. This is a small piece of code in the user's space that interfaces the user's signal handler to the kernel. The library provides a standard one, __signalstub(). This argument can be NULL if act is also NULL.

**signo** —

The signal whose action you want to set or get; see “[POSIX and QNX Neutrino signals](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/s/signalaction.html#signalaction__POSIXSignals),” below.

If the signal terminates a process, the cleanup of the terminated process occurs by default at the priority of the thread that sent the signal. If you OR the SIG_TERMER_NOINHERIT flag (defined in <signal.h>) into signo, the cleanup occurs at the priority of the thread that received the signal.

**act** —

NULL, or a pointer to a [sigaction](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/s/sigaction_struct.html "Structure that specifies how to handle a signal") structure that specifies the new action for the signal.

**oact** —

NULL, or a pointer to a sigaction structure where the function can store the old action.

## Library:

libc

Use the -l c option to [qcc](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.utilities/topic/q/qcc.html) to link against this library. This library is usually included automatically.

## Description:

The SignalAction() and SignalAction_r() kernel calls let the calling process examine or specify (or both) the action to be associated with a specific signal in the process pid. If pid is zero, the calling process is used. The argument signo specifies the signal.

- You should call the POSIX [sigaction()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/s/sigaction.html "Examine or specify the action associated with a signal") function or the ANSI [signal()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/s/signal.html "Set handling for exceptional conditions") function instead of using these kernel calls directly.
- In order to attach signal handlers to a process with a different real or effective user ID, your process must have the PROCMGR_AID_SIGNAL ability enabled. For more information, see [procmgr_ability()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/procmgr_ability.html "Control a process's ability to perform certain operations").

These functions are identical except in the way they indicate errors. See the [Returns](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/s/signalaction.html#signalaction__Returns) section for details.

If act isn't NULL, then the specified signal is modified. If oact isn't NULL, the previous action is stored in the structure it points to. You can use various combinations of act and oact to query or set (or both) the action for a signal.

Signal handlers and actions are defined for the process and affect all threads in the process. For example, if one thread ignores a signal, then all threads ignore the signal.

You can target a signal at a thread, process or process group (see [SignalKill()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/s/signalkill.html "Send a signal to a process group, process, or thread")). When targeted at a process, at most one thread receives the signal. This thread must have the signal unblocked (see [SignalProcmask()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/s/signalprocmask.html "Modify or examine a thread's signal-blocked mask")) to be a candidate for receiving it. All synchronously generated signals (e.g. SIGSEGV) are always delivered to the thread that caused them.

In a multithreaded process, if a signal terminates a thread, by default all threads and thus the process are terminated. You can override this standard POSIX behavior when you create the thread; see the PTHREAD_MULTISIG_ALLOW and PTHREAD_MULTISIG_DISALLOW flags in the entry for [ThreadCreate()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/t/threadcreate.html "Create a thread").

- It isn't safe to use floating-point operations in signal handlers.
- If you use [longjmp()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/l/longjmp.html "Restore the environment saved by setjmp()") to return from a signal handler, the signal remains masked. You can use [siglongjmp()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/s/siglongjmp.html "Restore the environment saved by sigsetjmp(), including the signal mask") to restore the mask to the state saved by a previous call to [sigsetjmp()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/s/sigsetjmp.html "Save the environment, including the signal mask").

**POSIX and QNX Neutrino signals**

The signals are defined in <signal.h>. The entire range of signals goes from _SIGMIN (1) to _SIGMAX (64):

|Signal range|Description|
|---|---|
|1–56|56 POSIX signals (including traditional UNIX signals)|
|41–56|16 POSIX realtime signals (SIGRTMIN to SIGRTMAX)|
|57–64|Eight special-purpose QNX Neutrino signals, some of which are named (e.g., SIGSELECT). They're always masked, and attempts to unmask them are ignored.|

The following global variables are also declared in <signal.h>:

const char * const sys_siglist[]

An array of descriptions of the signals. You can use [strsignal()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/s/strsignal.html "Return the description of a signal") to get the description of a signal.

const int sys_nsig

The number of entries in the sys_siglist array.

The sys_siglist array doesn't include the QNX Neutrino signals, and strsignal() returns a pointer to an empty string for them.

The POSIX and UNIX signals include:

|Signal|Description|Default action|
|---|---|---|
|SIGABRT|Abnormal termination, issued by functions such as [abort()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/a/abort.html "Raise the SIGABRT signal to terminate program execution")|Kill the process and write a dump file|
|SIGALRM|Alarm clock, issued by functions such as [alarm()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/a/alarm.html "Schedule an alarm")|Kill the process|
|SIGBUS|Bus error, or a memory parity error (a QNX Neutrino-specific interpretation). If a second fault occurs while your process is in a signal handler for this fault, the process is terminated.|Kill the process and write a dump file|
|SIGCHLD or SIGCLD|A child process terminated|Ignore the signal, but still let the process's children become zombies|
|SIGCONT|Continue the process. You can't block this signal.|Make the process continue if it's STOPPED; otherwise ignore the signal|
|SIGDEADLK|A mutex deadlock occurred. If a process dies while holding a non-robust mutex and no still-existing process has called [SyncMutexEvent()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/s/syncmutexevent.html "Attach an event to a mutex") to set up an event to be delivered when the mutex owner dies, the kernel delivers a SIGDEADLK to all threads that are waiting on the mutex without a timeout. The kernel also delivers this signal if an event has been set up but its target is the same process that has died and this process didn't call [procmgr_guardian()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/procmgr_guardian.html "Let a process take over as a parent") to designate another process as the new parent to its children. Note that it's up to any guardian process to revive the mutex by calling [SyncMutexRevive()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/s/syncmutexrevive.html "Revive a mutex that's in the DEAD state"), as the signal is not sent in this case.<br><br>SIGDEADLK and SIGEMT refer to the same signal. Some utilities (e.g., [gdb](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.utilities/topic/g/gdb.html), [ksh](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.utilities/topic/k/ksh.html), [slay](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.utilities/topic/s/slay.html), and [kill](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.utilities/topic/k/kill.html)) know about SIGEMT, but not SIGDEADLK.|Kill the process and write a dump file|
|SIGEMT|EMT instruction (emulation trap)<br><br>SIGDEADLK and SIGEMT refer to the same signal. Some utilities (e.g., [gdb](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.utilities/topic/g/gdb.html), [ksh](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.utilities/topic/k/ksh.html), [slay](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.utilities/topic/s/slay.html), and [kill](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.utilities/topic/k/kill.html)) know about SIGEMT, but not SIGDEADLK.|Kill the process and write a dump file|
|SIGFPE|Floating point exception|Kill the process and write a dump file|
|SIGHUP|Hangup; the session leader died, or the controlling terminal closed|Kill the process|
|SIGILLa|Illegal hardware instruction. If a second fault occurs while your thread is in a signal handler for this fault, the process is terminated.|Kill the process and write a dump file|
|SIGINT|Interrupt; typically generated when you press Ctrl–C or Ctrl–Break (you can change this with [stty](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.utilities/topic/s/stty.html))|Kill the process|
|SIGIO|Asynchronous I/O|Ignore the signal|
|SIGIOT|I/O trap; a synonym for SIGABRT|Kill the process|
|SIGKILL|Kill. You can't block or catch this signal.|Kill the process|
|SIGPIPE|Write on pipe with no reader|Kill the process|
|SIGPOLL|System V name for SIGIO|Ignore the signal|
|SIGPROF|Profiling timer expired. POSIX has marked this signal as obsolescent; QNX Neutrino doesn't support profiling timers or send this signal.|Kill the process|
|SIGPWR|Power failure|Ignore the signal|
|SIGQUIT|Quit; typically generated when you press Ctrl–\ (you can change this with [stty](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.utilities/topic/s/stty.html))|Kill the process and write a dump file|
|SIGSEGV|Segmentation violation; an invalid memory reference was detected. If a second fault occurs while your process is in a signal handler for this fault, the process will be terminated.|Kill the process and write a dump file|
|SIGSTOP|Stop the process. You can't block or catch this signal.|Stop the process|
|SIGSYS|Bad argument to system call|Kill the process and write a dump file|
|SIGTERM|Termination signal|Kill the process|
|SIGTRAP|Trace trap|Kill the process and write a dump file|
|SIGTSTP|Stop signal from tty; typically generated when you press Ctrl–Z (you can change this with [stty](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.utilities/topic/s/stty.html))|Stop the process|
|SIGTTIN|Background read attempted from control terminal|Stop the process|
|SIGTTOU|Background write attempted to control terminal|Stop the process|
|SIGURG|Urgent condition on I/O channel|Ignore the signal|
|SIGUSR1|User-defined signal 1|Kill the process|
|SIGUSR2|User-defined signal 2|Kill the process|
|SIGVTALRM|Virtual timer expired. POSIX has marked this signal as obsolescent; QNX Neutrino doesn't support virtual timers or send this signal.|Kill the process|
|SIGWINCH|The size of the terminal window changed|Ignore the signal|
|SIGXCPU|Soft CPU time limit exceeded see the RLIMIT_CPU resource for [setrlimit()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/s/setrlimit.html "Set the limit on a system resource"))|Kill the process and write a dump file|

a One possible cause for a SIGILL signal is trying to perform an operation that requires _I/O privileges_. A thread can request these privileges by making sure the process has the PROCMGR_AID_IO ability enabled (see [procmgr_ability()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/procmgr_ability.html "Control a process's ability to perform certain operations")) and then calling [ThreadCtl()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/t/threadctl.html "Control a thread"), specifying the _NTO_TCTL_IO flag:

ThreadCtl( _NTO_TCTL_IO, 0 );

**Blocking states**

These calls don't block.

## Returns:

The only difference between these functions is the way they indicate errors:

SignalAction()

If an error occurs, -1 is returned and [errno](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/e/errno.html "Thread-local error variable") is set. Any other value returned indicates success.

SignalAction_r()

EOK is returned on success. This function does **NOT** set errno. If an error occurs, any value in the Errors section may be returned.

## Errors:

### `EAGAIN`

The system was unable to allocate a signal handler. This indicated critically low memory.

### `EFAULT`

A fault occurred when the kernel tried to access the buffers provided.

### `EINVAL`

The value of signo is less than 1 or greater than _SIGMAX, or you tried to set SIGKILL or SIGSTOP to something other than SIG_DFL.

### `EPERM`

The calling process doesn't have the required permission; see [procmgr_ability()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/procmgr_ability.html "Control a process's ability to perform certain operations").

### `ESRCH`

The process indicated by pid doesn't exist.

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

[abort()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/a/abort.html "Raise the SIGABRT signal to terminate program execution")

[ChannelCreate(), ChannelCreate_r()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/c/channelcreate.html "Create a communications channel")

[kill()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/k/kill.html "Send a signal to a process or a group of processes")

[longjmp()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/l/longjmp.html "Restore the environment saved by setjmp()")

[procmgr_ability()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/procmgr_ability.html "Control a process's ability to perform certain operations")

[siginfo_t](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/s/siginfo_t.html "Information about a signal")

[siglongjmp()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/s/siglongjmp.html "Restore the environment saved by sigsetjmp(), including the signal mask")

[signal()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/s/signal.html "Set handling for exceptional conditions")

[sigaction()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/s/sigaction.html "Examine or specify the action associated with a signal")

[struct sigaction](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/s/sigaction_struct.html "Structure that specifies how to handle a signal")

[SignalKill(), SignalKill_r()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/s/signalkill.html "Send a signal to a process group, process, or thread")

[SignalKillSigval(), SignalKillSigval_r()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/s/signalkillsigval.html "Send a signal to a process group, process, or thread")

[SignalProcmask(), SignalProcmask_r()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/s/signalprocmask.html "Modify or examine a thread's signal-blocked mask")

[sigqueue()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/s/sigqueue.html "Queue a signal to a process")

[sigsetjmp()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/s/sigsetjmp.html "Save the environment, including the signal mask")

[SyncMutexLock(), SyncMutexLock_r()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/s/syncmutexlock.html "Lock a mutex synchronization object")

[ThreadCreate(), ThreadCreate_r()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/t/threadcreate.html "Create a thread")

[wait()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/w/wait.html "Wait for the status of a terminated child process")

[waitpid()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/w/waitpid.html "Wait for a child process to stop or terminate")
