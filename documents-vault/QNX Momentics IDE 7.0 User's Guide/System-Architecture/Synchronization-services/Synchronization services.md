---
title: "Synchronization services"
category: "Synchronization-services"
source: "https://www.qnx.com/developers/docs/7.0.0/"
tags: [qnx, synchronization, mutex, semaphore]
---

# Synchronization services

The QNX Neutrino RTOS provides the POSIX-standard thread-level synchronization primitives, some of which are useful even between threads in different processes.

The synchronization services include at least the following:

|Synchronization service|Supported between processes|Supported across a QNX Neutrino LAN|
|---|---|---|
|[Mutexes](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.sys_arch/topic/kernel_Mutexes.html "Mutual exclusion locks, or mutexes, are the simplest of the synchronization services. A mutex is used to ensure exclusive access to data shared between threads.")|Yesa|No|
|[Condvars](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.sys_arch/topic/kernel_Condvars.html "A condition variable, or condvar, is used to block a thread within a critical section until some condition is satisfied. The condition can be arbitrarily complex and is independent of the condvar. However, the condvar must always be used with a mutex lock in order to implement a monitor.")|Yes|No|
|[Barriers](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.sys_arch/topic/kernel_Barriers.html "A barrier is a synchronization mechanism that lets you “corral” several cooperating threads (e.g., in a matrix computation), forcing them to wait at a specific point until all have finished before any one thread can continue.")|Yesa|No|
|[Sleepon locks](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.sys_arch/topic/kernel_Sleepon_locks.html "Sleepon locks are very similar to condvars, with a few subtle differences.")|No|No|
|[Reader/writer locks](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.sys_arch/topic/kernel_Reader_writer_locks.html "More formally known as “Multiple readers, single writer locks,” these locks are used when the access pattern for a data structure consists of many threads reading the data, and (at most) one thread writing the data. These locks are more expensive than mutexes, but can be useful for this data access pattern.")|Yesa|No|
|[Semaphores](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.sys_arch/topic/kernel_Semaphores.html "Semaphores are another common form of synchronization that allows threads to “post” and “wait” on a semaphore to control when threads wake or sleep.")|Yes|Yes (named only)|
|[FIFO scheduling](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.sys_arch/topic/kernel_Sync_scheduling.html "By selecting the POSIX FIFO scheduling policy, we can guarantee that no two threads of the same priority execute the critical section concurrently on a non-SMP system.")|Yes|No|
|[Send/Receive/Reply](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.sys_arch/topic/kernel_Sync_message_passing.html "Our Send/Receive/Reply message-passing IPC services (described later) implement an implicit synchronization by their blocking nature. These IPC services can, in many instances, render other synchronization services unnecessary. They are also the only synchronization and IPC primitives (other than named semaphores, which are built on top of messaging) that can be used across the network.")|Yes|Yes|
|[Atomic operations](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.sys_arch/topic/kernel_Sync_atomic.html "In some cases, you may want to perform a short operation (such as incrementing a variable) with the guarantee that the operation will perform atomically—i.e., the operation won't be preempted by another thread or ISR (Interrupt Service Routine).")|Yes|No|

a Sharing this type of object between processes can be a security problem; see “[Safely sharing mutexes, barriers, and reader/writer locks between processes](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.sys_arch/topic/kernel_Sharing_sync.html "You can share most synchronization objects between processes, but security can be a concern."),” later in this chapter.

The above synchronization primitives are implemented directly by the kernel, except for:

- barriers, sleepon locks, and reader/writer locks (which are built from mutexes and condvars)
- atomic operations (which are either implemented directly by the processor or emulated in the kernel)

You should allocate mutexes, condvars, barriers, reader/writer locks, and semaphores, as well as objects you plan to use atomic operations on, only in normal memory mappings. On certain processors, atomic operations and calls such as [pthread_mutex_lock()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_mutex_lock.html) will cause a fault if the object is allocated in uncached memory.

- **[Mutexes: mutual exclusion locks](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.sys_arch/topic/kernel_Mutexes.html)**  
    Mutual exclusion locks, or _mutexes_, are the simplest of the synchronization services. A mutex is used to ensure exclusive access to data shared between threads.
- **[Condvars: condition variables](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.sys_arch/topic/kernel_Condvars.html)**  
    A condition variable, or _condvar_, is used to block a thread within a critical section until some condition is satisfied. The condition can be arbitrarily complex and is independent of the condvar. However, the condvar must always be used with a mutex lock in order to implement a monitor.
- **[Barriers](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.sys_arch/topic/kernel_Barriers.html)**  
    A barrier is a synchronization mechanism that lets you “corral” several cooperating threads (e.g., in a matrix computation), forcing them to wait at a specific point until all have finished before any one thread can continue.
- **[Sleepon locks](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.sys_arch/topic/kernel_Sleepon_locks.html)**  
    Sleepon locks are very similar to condvars, with a few subtle differences.
- **[Reader/writer locks](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.sys_arch/topic/kernel_Reader_writer_locks.html)**  
    More formally known as “Multiple readers, single writer locks,” these locks are used when the access pattern for a data structure consists of many threads reading the data, and (at most) one thread writing the data. These locks are more expensive than mutexes, but can be useful for this data access pattern.
- **[Safely sharing mutexes, barriers, and reader/writer locks between processes](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.sys_arch/topic/kernel_Sharing_sync.html)**  
    You can share most synchronization objects between processes, but security can be a concern.
- **[Semaphores](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.sys_arch/topic/kernel_Semaphores.html)**  
    Semaphores are another common form of synchronization that allows threads to “post” and “wait” on a semaphore to control when threads wake or sleep.
- **[Synchronization via scheduling policy](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.sys_arch/topic/kernel_Sync_scheduling.html)**  
    By selecting the POSIX FIFO scheduling policy, we can guarantee that no two threads of the same priority execute the critical section concurrently on a non-SMP system.
- **[Synchronization via message passing](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.sys_arch/topic/kernel_Sync_message_passing.html)**  
    Our Send/Receive/Reply message-passing IPC services (described later) implement an implicit synchronization by their blocking nature. These IPC services can, in many instances, render other synchronization services unnecessary. They are also the only synchronization and IPC primitives (other than named semaphores, which are built on top of messaging) that can be used across the network.
- **[Synchronization via atomic operations](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.sys_arch/topic/kernel_Sync_atomic.html)**  
    In some cases, you may want to perform a short operation (such as incrementing a variable) with the guarantee that the operation will perform _atomically_—i.e., the operation won't be preempted by another thread or ISR (Interrupt Service Routine).
- **[Synchronization services implementation](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.sys_arch/topic/kernel_Synchronization_services.html)**
