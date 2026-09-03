---
title: "Condvars: condition variables"
category: "Synchronization-services"
source: "https://www.qnx.com/developers/docs/7.0.0/"
tags: [qnx, synchronization, mutex, semaphore]
---

# Condvars: condition variables

A condition variable, or _condvar_, is used to block a thread within a critical section until some condition is satisfied. The condition can be arbitrarily complex and is independent of the condvar. However, the condvar must always be used with a mutex lock in order to implement a monitor.

A condvar supports three operations:

- wait ([pthread_cond_wait()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_cond_wait.html))
- signal ([pthread_cond_signal()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_cond_signal.html))
- broadcast ([pthread_cond_broadcast()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_cond_broadcast.html))

Note that there's no connection between a condvar signal and a POSIX signal.

Here's a typical example of how a condvar can be used:

pthread_mutex_lock( &m );
. . .
while (!arbitrary_condition) {
    pthread_cond_wait( &cv, &m );
    }
. . .
pthread_mutex_unlock( &m );

In this code sample, the mutex is acquired before the condition is tested. This ensures that only this thread has access to the arbitrary condition being examined. While the condition is true, the code sample will block on the wait call until some other thread performs a signal or broadcast on the condvar.

The while loop is required for two reasons. First of all, POSIX cannot guarantee that false wakeups will not occur (e.g., multiprocessor systems). Second, when another thread has made a modification to the condition, we need to retest to ensure that the modification matches our criteria. The associated mutex is unlocked atomically by [pthread_cond_wait()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_cond_wait.html) when the waiting thread is blocked to allow another thread to enter the critical section.

A thread that performs a signal will unblock the highest-priority thread queued on the condvar, while a broadcast will unblock all threads queued on the condvar. The associated mutex is locked atomically by the highest-priority unblocked thread; the thread must then unlock the mutex after proceeding through the critical section.

A version of the condvar wait operation allows a timeout to be specified ([pthread_cond_timedwait()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_cond_timedwait.html)). The waiting thread can then be unblocked when the timeout expires.

An application shouldn't use a PTHREAD_MUTEX_RECURSIVE mutex with condition variables because the implicit unlock performed for a [pthread_cond_wait()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_cond_wait.html) or [pthread_cond_timedwait()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_cond_timedwait.html) may not actually release the mutex (if it's been locked multiple times). If this happens, no other thread can satisfy the condition of the predicate.

### Related concepts  

[Safely sharing mutexes, barriers, and reader/writer locks between processes](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.sys_arch/topic/kernel_Sharing_sync.html "You can share most synchronization objects between processes, but security can be a concern.")

[Condition variables (Getting Started with QNX Neutrino)](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.getting_started/topic/s1_procs_condvar.html "Condition variables (Getting Started with QNX Neutrino)")

### Related reference  

[pthread_condattr_destroy()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_condattr_destroy.html "pthread_condattr_destroy()")

[pthread_condattr_getclock()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_condattr_getclock.html "pthread_condattr_getclock()")

[pthread_condattr_getpshared()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_condattr_getpshared.html "pthread_condattr_getpshared()")

[pthread_condattr_init()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_condattr_init.html "pthread_condattr_init()")

[pthread_condattr_setclock()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_condattr_setclock.html "pthread_condattr_setclock()")

[pthread_condattr_setpshared()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_condattr_setpshared.html "pthread_condattr_setpshared()")

[pthread_cond_broadcast()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_cond_broadcast.html "pthread_cond_broadcast()")

[pthread_cond_destroy()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_cond_destroy.html "pthread_cond_destroy()")

[pthread_cond_init()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_cond_init.html "pthread_cond_init()")

[pthread_cond_signal()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_cond_signal.html "pthread_cond_signal()")

[pthread_cond_timedwait()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_cond_timedwait.html "pthread_cond_timedwait()")

[pthread_cond_wait()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_cond_wait.html "pthread_cond_wait()")
