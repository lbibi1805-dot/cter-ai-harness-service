---
title: "Thread life cycle"
category: "Thread-and-Processes"
source: "https://www.qnx.com/developers/docs/7.0.0/"
tags: [qnx, thread, process, pthread]
---

# Thread life cycle

The number of threads within a process can vary widely, with threads being created and destroyed dynamically.

Thread creation ([pthread_create()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_create.html)) involves allocating and initializing the necessary resources within the process's address space (e.g., thread stack) and starting the execution of the thread at some function in the address space.

Thread termination ([pthread_exit()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_exit.html), [pthread_cancel()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_cancel.html)) involves stopping the thread and reclaiming the thread's resources. As a thread executes, its state can generally be described as either “ready” or “blocked.” More specifically, it can be one of the following:

![](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.sys_arch/images/thread_states.png) 
Figure 1. Possible thread states. Note that, in addition to the transitions shown above, a thread can move from any state (except DEAD) to READY.

STATE_CONDVAR

The thread is blocked on a condition variable (e.g., it called [pthread_cond_wait()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_cond_wait.html)).

STATE_DEAD

The thread has terminated and is waiting for a join by another thread.

STATE_INTR

The thread is blocked waiting for an interrupt (i.e., it called [InterruptWait()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/i/interruptwait.html)).

STATE_JOIN

The thread is blocked waiting to join another thread (e.g., it called [pthread_join()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_join.html)).

STATE_MUTEX

The thread is blocked on a mutual exclusion lock (e.g., it called [pthread_mutex_lock()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_mutex_lock.html)).

STATE_NANOSLEEP

The thread is sleeping for a short time interval (e.g., it called [nanosleep()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/n/nanosleep.html)).

STATE_NET_REPLY

The thread is waiting for a reply to be delivered across the network (i.e., it called [MsgReply*()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/msgreply.html)).

STATE_NET_SEND

The thread is waiting for a pulse or signal to be delivered across the network (i.e., it called [MsgSendPulse()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/msgsendpulse.html), [MsgDeliverEvent()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/msgdeliverevent.html), or [SignalKill()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/s/signalkill.html)).

STATE_READY

The thread is waiting to be executed while the processor executes another thread of equal or higher priority.

STATE_RECEIVE

The thread is blocked on a message receive (e.g., it called [MsgReceive()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/msgreceive.html)).

STATE_REPLY

The thread is blocked on a message reply (i.e., it called [MsgSend()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/msgsend.html), and the server received the message).

STATE_RUNNING

The thread is being executed by a processor. The kernel uses an array (with one entry per processor in the system) to keep track of the running threads.

STATE_SEM

The thread is waiting for a semaphore to be posted (i.e., it called [SyncSemWait()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/s/syncsemwait.html)).

STATE_SEND

The thread is blocked on a message send (e.g., it called [MsgSend()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/msgsend.html), but the server hasn't yet received the message).

STATE_SIGSUSPEND

The thread is blocked waiting for a signal (i.e., it called [sigsuspend()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/s/sigsuspend.html)).

STATE_SIGWAITINFO

The thread is blocked waiting for a signal (i.e., it called [sigwaitinfo()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/s/sigwaitinfo.html)).

STATE_STACK

The thread is waiting for the virtual address space to be allocated for the thread's stack (parent will have called [ThreadCreate()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/t/threadcreate.html)).

STATE_STOPPED

The thread is blocked waiting for a SIGCONT signal.

STATE_WAITCTX

The thread is waiting for a noninteger (e.g., floating point) context to become available for use.

STATE_WAITPAGE

The thread is waiting for physical memory to be allocated for a virtual address.

STATE_WAITTHREAD

The thread is waiting for a child thread to finish creating itself (i.e., it called [ThreadCreate()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/t/threadcreate.html)).

In discussion and in the documentation, we usually omit the “STATE_” prefix.

### Related concepts  

[Kernel states (Getting Started with QNX Neutrino)](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.getting_started/topic/s1_procs_kstate.html "Kernel states (Getting Started with QNX Neutrino)")

### Related reference  

[pthread_join()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_join.html "pthread_join()")

[MsgReply*()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/msgreply.html "MsgReply*()")

[InterruptWait()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/i/interruptwait.html "InterruptWait()")

[MsgDeliverEvent()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/msgdeliverevent.html "MsgDeliverEvent()")

[MsgReceive()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/msgreceive.html "MsgReceive()")

[MsgSend()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/msgsend.html "MsgSend()")

[MsgSendPulse()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/msgsendpulse.html "MsgSendPulse()")

[nanosleep()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/n/nanosleep.html "nanosleep()")

[pthread_cancel()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_cancel.html "pthread_cancel()")

[pthread_cond_wait()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_cond_wait.html "pthread_cond_wait()")

[pthread_create()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_create.html "pthread_create()")

[pthread_exit()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_exit.html "pthread_exit()")

[pthread_mutex_lock()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_mutex_lock.html "pthread_mutex_lock()")

[SignalKill()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/s/signalkill.html "SignalKill()")

[sigsuspend()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/s/sigsuspend.html "sigsuspend()")

[sigwaitinfo()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/s/sigwaitinfo.html "sigwaitinfo()")

[SyncSemWait()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/s/syncsemwait.html "SyncSemWait()")

[ThreadCreate()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/t/threadcreate.html "ThreadCreate()")
