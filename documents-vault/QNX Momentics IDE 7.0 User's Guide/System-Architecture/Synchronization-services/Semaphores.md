---
title: "Semaphores"
category: "Synchronization-services"
source: "https://www.qnx.com/developers/docs/7.0.0/"
tags: [qnx, synchronization, mutex, semaphore]
---

# Semaphores
Semaphores are another common form of synchronization that allows threads to “post” and “wait” on a semaphore to control when threads wake or sleep.

The post ([sem_post()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/s/sem_post.html)) operation increments the semaphore; the wait ([sem_wait()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/s/sem_wait.html)) operation decrements it.

If you wait on a semaphore that is positive, you will not block. Waiting on a nonpositive semaphore will block until some other thread executes a post. It is valid to post one or more times before a wait. This use will allow one or more threads to execute the wait without blocking.

A significant difference between semaphores and other synchronization primitives is that semaphores are “async safe” and can be manipulated by signal handlers. If the desired effect is to have a signal handler wake a thread, semaphores are the right choice.

Note that in general, mutexes are much faster than semaphores, which always require a kernel entry. Semaphores don't affect a thread's effective priority; if you need priority inheritance, use a mutex. For more information, see “[Mutexes: mutual exclusion locks](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.sys_arch/topic/kernel_Mutexes.html "Mutual exclusion locks, or mutexes, are the simplest of the synchronization services. A mutex is used to ensure exclusive access to data shared between threads."),” earlier in this chapter.

Another useful property of semaphores is that they were defined to operate between processes. Although our mutexes work between processes, the POSIX thread standard considers this an optional capability and as such may not be portable across systems. For synchronization between threads in a single process, mutexes will be more efficient than semaphores.

As a useful variation, a _named_ semaphore service is also available. It lets you use semaphores between processes on different machines connected by a network.

Note that named semaphores are _slower_ than the unnamed variety.

Since semaphores, like condition variables, can legally return a nonzero value because of a false wake-up, correct usage requires a loop:

```c
while (sem_wait(&s) && (errno == EINTR)) { do_nothing(); }
do_critical_region();   /* Semaphore was decremented */
```

### Related concepts  

[Semaphores (Getting Started with QNX Neutrino)](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.getting_started/topic/s1_procs_semaphore.html "Semaphores (Getting Started with QNX Neutrino)")

[A semaphore as a mutex (Getting Started with QNX Neutrino)](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.getting_started/topic/s1_procs_Semaphore_as_mutex.html "A semaphore as a mutex (Getting Started with QNX Neutrino)")

### Related reference  

[sem_close()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/s/sem_close.html "sem_close()")

[sem_destroy()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/s/sem_destroy.html "sem_destroy()")

[sem_getvalue()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/s/sem_getvalue.html "sem_getvalue()")

[sem_init()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/s/sem_init.html "sem_init()")

[sem_open()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/s/sem_open.html "sem_open()")

[sem_post()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/s/sem_post.html "sem_post()")

[sem_timedwait()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/s/sem_timedwait.html "sem_timedwait()")

[sem_trywait()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/s/sem_trywait.html "sem_trywait()")

[sem_unlink()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/s/sem_unlink.html "sem_unlink()")

[sem_wait()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/s/sem_wait.html "sem_wait()")
