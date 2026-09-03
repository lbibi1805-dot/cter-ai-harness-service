---
title: "Threads and processes"
category: "Thread-and-Processes"
source: "https://www.qnx.com/developers/docs/7.0.0/"
tags: [qnx, thread, process, pthread]
---

# Threads and processes

When building an application (realtime, embedded, graphical, or otherwise), the developer may want several algorithms within the application to execute concurrently. This concurrency is achieved by using the POSIX thread model, which defines a process as containing one or more threads of execution.

A thread can be thought of as the minimum “unit of execution,” the unit of scheduling and execution in the microkernel. A process, on the other hand, can be thought of as a “container” for threads, defining the “address space” within which threads will execute. A process will always contain at least one thread.

Depending on the nature of the application, threads might execute independently with no need to communicate between the algorithms (unlikely), or they may need to be tightly coupled, with high-bandwidth communications and tight synchronization. To assist in this communication and synchronization, the QNX Neutrino RTOS provides a rich variety of IPC and synchronization services.

The following pthread_* (POSIX Threads) library calls don't involve any microkernel thread calls:

- [pthread_attr_destroy()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_attr_destroy.html)
- [pthread_attr_getdetachstate()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_attr_getdetachstate.html)
- [pthread_attr_getinheritsched()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_attr_getinheritsched.html)
- [pthread_attr_getschedparam()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_attr_getschedparam.html)
- [pthread_attr_getschedpolicy()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_attr_getschedpolicy.html)
- [pthread_attr_getscope()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_attr_getscope.html)
- [pthread_attr_getstackaddr()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_attr_getstackaddr.html)
- [pthread_attr_getstacksize()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_attr_getstacksize.html)
- [pthread_attr_init()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_attr_init.html)
- [pthread_attr_setdetachstate()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_attr_setdetachstate.html)
- [pthread_attr_setinheritsched()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_attr_setinheritsched.html)
- [pthread_attr_setschedparam()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_attr_setschedparam.html)
- [pthread_attr_setschedpolicy()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_attr_setschedpolicy.html)
- [pthread_attr_setscope()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_attr_setscope.html)
- [pthread_attr_setstackaddr()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_attr_setstackaddr.html)
- [pthread_attr_setstacksize()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_attr_setstacksize.html)
- [pthread_cleanup_pop()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_cleanup_pop.html)
- [pthread_cleanup_push()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_cleanup_push.html)
- [pthread_equal()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_equal.html)
- [pthread_getspecific()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_getspecific.html)
- [pthread_setspecific()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_setspecific.html)
- [pthread_key_create()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_key_create.html)
- [pthread_key_delete()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_key_delete.html)
- [pthread_self()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_self.html)

The following table lists the POSIX thread calls that have a corresponding microkernel thread call, allowing you to choose either interface:

|POSIX call|Microkernel call|Description|
|---|---|---|
|[pthread_create()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_create.html)|[ThreadCreate()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/t/threadcreate.html)|Create a new thread of execution|
|[pthread_exit()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_exit.html)|[ThreadDestroy()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/t/threaddestroy.html)|Destroy a thread|
|[pthread_detach()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_detach.html)|[ThreadDetach()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/t/threaddetach.html)|Detach a thread so it doesn't need to be joined|
|[pthread_join()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_join.html)|[ThreadJoin()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/t/threadjoin.html)|Join a thread waiting for its exit status|
|[pthread_cancel()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_cancel.html)|[ThreadCancel()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/t/threadcancel.html)|Cancel a thread at the next cancellation point|
|N/A|[ThreadCtl()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/t/threadctl.html)|Change a thread's QNX Neutrino-specific thread characteristics|
|[pthread_mutex_init()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_mutex_init.html)|[SyncTypeCreate()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/s/synctypecreate.html)|Create a mutex|
|[pthread_mutex_destroy()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_mutex_destroy.html)|[SyncDestroy()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/s/syncdestroy.html)|Destroy a mutex|
|[pthread_mutex_lock()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_mutex_lock.html)|[SyncMutexLock()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/s/syncmutexlock.html)|Lock a mutex|
|[pthread_mutex_trylock()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_mutex_trylock.html)|[SyncMutexLock()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/s/syncmutexlock.html)|Conditionally lock a mutex|
|[pthread_mutex_unlock()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_mutex_unlock.html)|[SyncMutexUnlock()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/s/syncmutexunlock.html)|Unlock a mutex|
|[pthread_cond_init()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_cond_init.html)|[SyncTypeCreate()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/s/synctypecreate.html)|Create a condition variable|
|[pthread_cond_destroy()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_cond_destroy.html)|[SyncDestroy()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/s/syncdestroy.html)|Destroy a condition variable|
|[pthread_cond_wait()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_cond_wait.html)|[SyncCondvarWait()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/s/synccondvarwait.html)|Wait on a condition variable|
|[pthread_cond_signal()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_cond_signal.html)|[SyncCondvarSignal()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/s/synccondvarsignal.html)|Signal a condition variable|
|[pthread_cond_broadcast()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_cond_broadcast.html)|[SyncCondvarSignal()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/s/synccondvarsignal.html)|Broadcast a condition variable|
|[pthread_getschedparam()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_getschedparam.html)|[SchedGet()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/s/schedget.html)|Get the scheduling parameters and policy of a thread|
|[pthread_setschedparam()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_setschedparam.html), [pthread_setschedprio()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_setschedprio.html)|[SchedSet()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/s/schedset.html)|Set the scheduling parameters and policy of a thread|
|[pthread_sigmask()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_sigmask.html)|[SignalProcmask()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/s/signalprocmask.html)|Examine or set a thread's signal mask|
|[pthread_kill()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_kill.html)|[SignalKill()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/s/signalkill.html)|Send a signal to a specific thread|

The OS can be configured to provide a mix of threads and processes (as defined by POSIX). Each process is MMU-protected from each other, and each process may contain one or more threads that share the process's address space.

The environment you choose affects not only the concurrency capabilities of the application, but also the IPC and synchronization services the application might make use of.

Even though the common term “IPC” refers to communicating processes, we use it here to describe the communication between _threads_, whether they're within the same process or separate processes.

For information about processes and threads from the programming point of view, see the [Processes and Threads](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.getting_started/topic/s1_procs.html) chapter of Getting Started with QNX Neutrino, and the [Programming Overview](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.prog/topic/overview.html) and [Processes](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.prog/topic/process.html) chapters of the QNX Neutrino Programmer's Guide.

- **[Thread attributes](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.sys_arch/topic/kernel_Thread_attributes.html)**  
    Although threads within a process share everything within the process's address space, each thread still has some “private” data. In some cases, this private data is protected within the kernel (e.g., the tid or thread ID), while other private data resides unprotected in the process's address space (e.g., each thread has a stack for its own use). Some of the more noteworthy thread-private resources are:
- **[Thread life cycle](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.sys_arch/topic/kernel_Life_Cycle.html)**  
    The number of threads within a process can vary widely, with threads being created and destroyed dynamically.

### Related concepts  

[Threads and processes (Getting Started with QNX Neutrino)](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.getting_started/topic/s1_procs_Threads_and_processes.html "Threads and processes (Getting Started with QNX Neutrino)")

[Programming Overview (QNX Neutrino Programmer's Guide)](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.prog/topic/overview.html "Programming Overview (QNX Neutrino Programmer's Guide)")

[Processes (QNX Neutrino Programmer's Guide)](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.prog/topic/process.html "Processes (QNX Neutrino Programmer's Guide)")
