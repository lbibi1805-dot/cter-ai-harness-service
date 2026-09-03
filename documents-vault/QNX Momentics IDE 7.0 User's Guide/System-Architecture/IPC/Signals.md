---
title: "Signals"
category: "IPC"
source: "https://www.qnx.com/developers/docs/7.0.0/"
tags: [qnx, ipc, message-passing]
---

# Signals
The OS supports the 32 standard POSIX signals (as in UNIX) as well as the POSIX realtime signals, both numbered from a kernel-implemented set of 64 signals with uniform functionality. While the POSIX standard defines realtime signals as differing from UNIX-style signals (in that they may contain four bytes of data and a byte code and may be queued for delivery), this functionality can be explicitly selected or deselected on a per-signal basis, allowing this converged implementation to still comply with the standard.

Incidentally, the UNIX-style signals can select POSIX realtime signal queuing, if the application wants it. The QNX Neutrino RTOS also extends the signal-delivery mechanisms of POSIX by allowing signals to be targeted at specific threads, rather than simply at the process containing the threads. Since signals are an asynchronous event, they're also implemented with the event-delivery mechanisms.

|Microkernel call|POSIX call|Description|
|---|---|---|
|[SignalKill()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/s/signalkill.html)|[kill()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/k/kill.html), [pthread_kill()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_kill.html), [raise()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/r/raise.html), [sigqueue()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/s/sigqueue.html)|Set a signal on a process group, process, or thread.|
|[SignalAction()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/s/signalaction.html)|[sigaction()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/s/sigaction.html)|Define action to take on receipt of a signal.|
|[SignalProcmask()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/s/signalprocmask.html)|[sigprocmask()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/s/sigprocmask.html), [pthread_sigmask()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_sigmask.html)|Change signal blocked mask of a thread.|
|[SignalSuspend()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/s/signalsuspend.html)|[sigsuspend()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/s/sigsuspend.html), [pause()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pause.html)|Block until a signal invokes a signal handler.|
|[SignalWaitinfo()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/s/signalwaitinfo.html)|[sigwaitinfo()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/s/sigwaitinfo.html)|Wait for signal and return info on it.|

The original POSIX specification defined signal operation on processes only. In a multithreaded process, the following rules are followed:

- Signals caused by CPU exceptions (e.g., SIGSEGV, SIGBUS) are always delivered to the thread that caused the exception.
- The signal actions are maintained at the process level. If a thread specifies an action for a signal (e.g., ignoring or catching it), the operation affects _all_ threads within the process.
- The signal mask is maintained at the thread level. If a thread blocks a signal, the blocking affects only that thread.
- An unignored signal targeted at a thread is delivered to that thread alone.
- An unignored signal targeted at a process is delivered to the first thread that doesn't have the signal blocked. If all threads have the signal blocked, the signal will be queued on the process until any thread ignores or unblocks the signal. If ignored, the signal on the process will be removed. If unblocked, the signal will be moved from the process to the thread that unblocked it.

When a signal is targeted at a process with a large number of threads, the thread table must be scanned, looking for a thread with the signal unblocked. Standard practice for most multithreaded processes is to mask the signal in all threads but one, which is dedicated to handling them. To increase the efficiency of process-signal delivery, the kernel will cache the last thread that accepted a signal and will always attempt to deliver the signal to it first.

![](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.sys_arch/images/signal.png) Figure 1. Signal delivery.

The POSIX standard includes the concept of queued realtime signals. The QNX Neutrino RTOS supports optional queuing of any signal, not just realtime signals. The queuing can be specified on a signal-by-signal basis within a process. Each signal can have an associated 8-bit code and a 32-bit value.

This is very similar to message pulses described earlier. The kernel takes advantage of this similarity and uses common code for managing both signals and pulses. The signal number is mapped to a pulse priority using _SIGMAX – signo. As a result, signals are delivered in priority order with _lower_ signal numbers having _higher_ priority. This conforms with the POSIX standard, which states that existing signals have priority over the new realtime signals.

It isn't safe to use floating-point operations in signal handlers.

- **[Special signals](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.sys_arch/topic/ipc_Special_signals.html)**  
    As mentioned earlier, the OS defines a total of 64 signals.
- **[Summary of signals](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.sys_arch/topic/ipc_Signal_summary.html)**  
    This table describes what each signal means.

### Related concepts  

[Process termination (QNX Neutrino Programmer's Guide)](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.prog/topic/process_PROCTERM.html "Process termination (QNX Neutrino Programmer's Guide)")

### Related reference  

[sigaction()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/s/sigaction.html "sigaction()")

[struct sigaction](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/s/sigaction_struct.html "struct sigaction")

[sigaddset()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/s/sigaddset.html "sigaddset()")

[sigblock()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/s/sigblock.html "sigblock()")

[sigdelset()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/s/sigdelset.html "sigdelset()")

[sigemptyset()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/s/sigemptyset.html "sigemptyset()")

[sigfillset()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/s/sigfillset.html "sigfillset()")

[sigismember()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/s/sigismember.html "sigismember()")

[siglongjmp()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/s/siglongjmp.html "siglongjmp()")

[sigmask()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/s/sigmask.html "sigmask()")

[SignalAction(), SignalAction_r()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/s/signalaction.html "SignalAction(), SignalAction_r()")

[SignalKill(), SignalKill_r()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/s/signalkill.html "SignalKill(), SignalKill_r()")

[SignalProcmask(), SignalProcmask_r()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/s/signalprocmask.html "SignalProcmask(), SignalProcmask_r()")

[SignalSuspend(), SignalSuspend_r()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/s/signalsuspend.html "SignalSuspend(), SignalSuspend_r()")

[SignalWaitinfo(), SignalWaitinfo_r()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/s/signalwaitinfo.html "SignalWaitinfo(), SignalWaitinfo_r()")

[signal()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/s/signal.html "signal()")

[sigpause()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/s/sigpause.html "sigpause()")

[sigpending()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/s/sigpending.html "sigpending()")

[sigprocmask()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/s/sigprocmask.html "sigprocmask()")

[sigqueue()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/s/sigqueue.html "sigqueue()")

[sigsetjmp()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/s/sigsetjmp.html "sigsetjmp()")

[sigsetmask()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/s/sigsetmask.html "sigsetmask()")

[sigsuspend()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/s/sigsuspend.html "sigsuspend()")

[sigtimedwait()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/s/sigtimedwait.html "sigtimedwait()")

[sigunblock()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/s/sigunblock.html "sigunblock()")

[sigwaitinfo()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/s/sigwaitinfo.html "sigwaitinfo()")

[sigwait()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/s/sigwait.html "sigwait()")

[strsignal()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/s/strsignal.html "strsignal()")

[SyncCondvarSignal(), SyncCondvarSignal_r()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/s/synccondvarsignal.html "SyncCondvarSignal(), SyncCondvarSignal_r()")
