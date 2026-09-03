---
title: "Reader/writer locks"
category: "Synchronization-services"
source: "https://www.qnx.com/developers/docs/7.0.0/"
tags: [qnx, synchronization, mutex, semaphore]
---

# Reader/writer locks

More formally known as “Multiple readers, single writer locks,” these locks are used when the access pattern for a data structure consists of many threads reading the data, and (at most) one thread writing the data. These locks are more expensive than mutexes, but can be useful for this data access pattern.

This lock works by allowing all the threads that request a read-access lock ([pthread_rwlock_rdlock()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_rwlock_rdlock.html)) to succeed in their request. But when a thread wishing to write asks for the lock ([pthread_rwlock_wrlock()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_rwlock_wrlock.html)), the request is denied until all the current reading threads release their reading locks ([pthread_rwlock_unlock()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_rwlock_unlock.html)).

Multiple writing threads can queue (in priority order) waiting for their chance to write the protected data structure, and all the blocked writer-threads will get to run before reading threads are allowed access again. The priorities of the reading threads are not considered.

There are also calls ([pthread_rwlock_tryrdlock()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_rwlock_tryrdlock.html) and [pthread_rwlock_trywrlock()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_rwlock_trywrlock.html)) to allow a thread to test the attempt to achieve the requested lock, without blocking. These calls return with a successful lock or a status indicating that the lock couldn't be granted immediately.

Reader/writer locks aren't implemented directly within the kernel, but are instead built from the mutex and condvar services provided by the kernel.

### Related concepts  

[Safely sharing mutexes, barriers, and reader/writer locks between processes](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.sys_arch/topic/kernel_Sharing_sync.html "You can share most synchronization objects between processes, but security can be a concern.")

[Readers/writer locks (Getting Started with QNX Neutrino)](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.getting_started/topic/s1_procs_rwlocks.html "Readers/writer locks (Getting Started with QNX Neutrino)")

### Related reference  

[pthread_rwlockattr_destroy()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_rwlockattr_destroy.html "pthread_rwlockattr_destroy()")

[pthread_rwlockattr_getclock()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_rwlockattr_getclock.html "pthread_rwlockattr_getclock()")

[pthread_rwlockattr_getpshared()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_rwlockattr_getpshared.html "pthread_rwlockattr_getpshared()")

[pthread_rwlockattr_init()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_rwlockattr_init.html "pthread_rwlockattr_init()")

[pthread_rwlockattr_setclock()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_rwlockattr_setclock.html "pthread_rwlockattr_setclock()")

[pthread_rwlockattr_setpshared()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_rwlockattr_setpshared.html "pthread_rwlockattr_setpshared()")

[pthread_rwlock_destroy()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_rwlock_destroy.html "pthread_rwlock_destroy()")

[pthread_rwlock_init()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_rwlock_init.html "pthread_rwlock_init()")

[pthread_rwlock_rdlock()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_rwlock_rdlock.html "pthread_rwlock_rdlock()")

[pthread_rwlock_timedrdlock()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_rwlock_timedrdlock.html "pthread_rwlock_timedrdlock()")

[pthread_rwlock_timedwrlock()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_rwlock_timedwrlock.html "pthread_rwlock_timedwrlock()")

[pthread_rwlock_tryrdlock()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_rwlock_tryrdlock.html "pthread_rwlock_tryrdlock()")

[pthread_rwlock_trywrlock()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_rwlock_trywrlock.html "pthread_rwlock_trywrlock()")

[pthread_rwlock_unlock()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_rwlock_unlock.html "pthread_rwlock_unlock()")

[pthread_rwlock_wrlock()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_rwlock_wrlock.html "pthread_rwlock_wrlock()")
