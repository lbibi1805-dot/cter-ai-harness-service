---
title: "Mutexes: mutual exclusion locks"
category: "Synchronization-services"
source: "https://www.qnx.com/developers/docs/7.0.0/"
tags: [qnx, synchronization, mutex, semaphore]
---

# Mutexes: mutual exclusion locks

Mutual exclusion locks, or _mutexes_, are the simplest of the synchronization services. A mutex is used to ensure exclusive access to data shared between threads.

A mutex is typically acquired ([pthread_mutex_lock()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_mutex_lock.html) or [pthread_mutex_timedlock()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_mutex_timedlock.html)) and released ([pthread_mutex_unlock()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_mutex_unlock.html)) around the code that accesses the shared data (usually a critical section).

Only one thread may have the mutex locked at any given time. Threads attempting to lock an already locked mutex will block until the thread that owns the mutex unlocks it. When the thread unlocks the mutex, the highest-priority thread waiting to lock the mutex will unblock and become the new owner of the mutex. In this way, threads will sequence through a critical region in priority-order.

In most situations, acquisition of a mutex doesn't require entry to the kernel for a free mutex. What allows this is the use of the compare-and-swap opcode on x86 processors and the load/store conditional opcodes on most RISC processors.

Entry to the kernel is necessary at acquisition time if the mutex is already held, so that the thread can go on a blocked list; kernel entry is done on exit if other threads are waiting to be unblocked on that mutex. This allows normal acquisition and release of an uncontested critical section or resource to be very quick, incurring work by the OS only to resolve contention.

A nonblocking lock function ([pthread_mutex_trylock()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_mutex_trylock.html)) can be used to test whether the mutex is currently locked or not. For best performance, the execution time of the critical section should be small and of bounded duration. A condvar should be used if the thread may block within the critical section.

## Priority inheritance and mutexes

By default, if a thread with a higher priority than the mutex owner attempts to lock a mutex, then the effective priority of the current owner is increased to that of the higher-priority blocked thread waiting for the mutex (but see below). The current owner's effective priority is again adjusted when it unlocks the mutex; its new priority is the maximum of its own priority and the priorities of those threads it still blocks, either directly or indirectly.

This scheme not only ensures that the higher-priority thread will be blocked waiting for the mutex for the shortest possible time, but also solves the classic priority-inversion problem.

The [pthread_mutexattr_init()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_mutexattr_init.html) function sets the protocol to PTHREAD_PRIO_INHERIT to allow this behavior; you can call [pthread_mutexattr_setprotocol()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_mutexattr_setprotocol.html) to override this setting. The [pthread_mutex_trylock()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_mutex_trylock.html) function doesn't change the thread priorities because it doesn't block.

What happens if the thread that's waiting for the mutex is running at a privileged priority, and the mutex owner's process doesn't have the PROCMGR_AID_PRIORITY ability enabled? In this case, the thread that owns the mutex is boosted to the highest unprivileged priority. For more information, see “[Scheduling priority](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.sys_arch/topic/kernel_Scheduling_priority.html "Every thread is assigned a priority. The thread scheduler selects the next thread to run by looking at the priority assigned to every thread that's READY (i.e., capable of using the CPU).")” earlier in this chapter and [procmgr_ability()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/procmgr_ability.html) in the C Library Reference.

## Other attributes

You can also modify other mutex attributes before initializing a mutex:

- Use [pthread_mutexattr_settype()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_mutexattr_settype.html) to allow a mutex to be recursively locked by the same thread. This can be useful to allow a thread to call a routine that might attempt to lock a mutex that the thread already happens to have locked.
- (QNX Neutrino 7.0 or later) Use [pthread_mutexattr_setrobust()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_mutexattr_setrobust.html) to set the mutex's robustness, which helps you recover the mutex if its owner terminates while holding it.
    
    The non-POSIX [SyncMutexEvent()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/s/syncmutexevent.html) kernel call provides a different (and mutually exclusive) mechanism for recovering a mutex.
    
- Use [pthread_mutexattr_setprioceiling()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_mutexattr_setprioceiling.html) to set the priority ceiling.

Note that robust mutexes, mutexes with priority ceilings, and those using SyncMutexEvent() use more system resources than other mutexes.

### Related concepts  

[Safely sharing mutexes, barriers, and reader/writer locks between processes](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.sys_arch/topic/kernel_Sharing_sync.html "You can share most synchronization objects between processes, but security can be a concern.")

[Mutual exclusion (Getting Started with QNX Neutrino)](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.getting_started/topic/s1_procs_mutex.html "Mutual exclusion (Getting Started with QNX Neutrino)")

[Semaphores (Getting Started with QNX Neutrino)](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.getting_started/topic/s1_procs_semaphore.html "Semaphores (Getting Started with QNX Neutrino)")

### Related reference  

[pthread_mutex_destroy()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_mutex_destroy.html "pthread_mutex_destroy()")

[pthread_mutex_getprioceiling()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_mutex_getprioceiling.html "pthread_mutex_getprioceiling()")

[pthread_mutex_init()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_mutex_init.html "pthread_mutex_init()")

[pthread_mutex_lock()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_mutex_lock.html "pthread_mutex_lock()")

[pthread_mutex_setprioceiling()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_mutex_setprioceiling.html "pthread_mutex_setprioceiling()")

[pthread_mutex_timedlock()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_mutex_timedlock.html "pthread_mutex_timedlock()")

[pthread_mutex_trylock()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_mutex_trylock.html "pthread_mutex_trylock()")

[pthread_mutex_unlock()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_mutex_unlock.html "pthread_mutex_unlock()")

[pthread_mutex_wakeup_np()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_mutex_wakeup_np.html "pthread_mutex_wakeup_np()")

[pthread_mutexattr_destroy()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_mutexattr_destroy.html "pthread_mutexattr_destroy()")

[pthread_mutexattr_getprioceiling()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_mutexattr_getprioceiling.html "pthread_mutexattr_getprioceiling()")

[pthread_mutexattr_getprotocol()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_mutexattr_getprotocol.html "pthread_mutexattr_getprotocol()")

[pthread_mutexattr_getpshared()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_mutexattr_getpshared.html "pthread_mutexattr_getpshared()")

[pthread_mutexattr_getrecursive()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_mutexattr_getrecursive.html "pthread_mutexattr_getrecursive()")

[pthread_mutexattr_gettype()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_mutexattr_gettype.html "pthread_mutexattr_gettype()")

[pthread_mutexattr_getwakeup_np()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_mutexattr_getwakeup_np.html "pthread_mutexattr_getwakeup_np()")

[pthread_mutexattr_init()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_mutexattr_init.html "pthread_mutexattr_init()")

[pthread_mutexattr_setprioceiling()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_mutexattr_setprioceiling.html "pthread_mutexattr_setprioceiling()")

[pthread_mutexattr_setprotocol()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_mutexattr_setprotocol.html "pthread_mutexattr_setprotocol()")

[pthread_mutexattr_setpshared()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_mutexattr_setpshared.html "pthread_mutexattr_setpshared()")

[pthread_mutexattr_setrecursive()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_mutexattr_setrecursive.html "pthread_mutexattr_setrecursive()")

[pthread_mutexattr_settype()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_mutexattr_settype.html "pthread_mutexattr_settype()")

[pthread_mutexattr_setwakeup_np()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_mutexattr_setwakeup_np.html "pthread_mutexattr_setwakeup_np()")
