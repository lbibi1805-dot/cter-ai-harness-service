---
title: "Thread Attributes"
category: "Thread-and-Processes"
source: "https://www.qnx.com/developers/docs/7.0.0/"
tags: [qnx, thread, process, pthread]
---

# Thread Attributes

Although threads within a process share everything within the process's address space, each thread still has some “private” data. In some cases, this private data is protected within the kernel (e.g., the tid or thread ID), while other private data resides unprotected in the process's address space (e.g., each thread has a stack for its own use). Some of the more noteworthy thread-private resources are:

**tid**

Each thread is identified by an integer thread ID, starting at 1. The tid is unique within the thread's process.

**Priority**

Each thread has a priority that helps determine when it runs. A thread inherits its initial priority from its parent, but the priority can change, depending on the scheduling policy, explicit changes that the thread makes, or messages sent to the thread.

In the QNX Neutrino RTOS, processes don't have priorities; their threads do.

For more information, see “[Thread scheduling](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.sys_arch/topic/kernel_SCHEDULING.html "When and how are scheduling decisions made?"),” later in this chapter.

Name

Starting with the QNX Neutrino Core OS 6.3.2, you can assign a name to a thread; see the entries for [pthread_getname_np()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_getname_np.html) and [pthread_setname_np()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_setname_np.html) in the QNX Neutrino C Library Reference. Utilities such as [dumper](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.utilities/topic/d/dumper.html) and [pidin](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.utilities/topic/p/pidin.html) support thread names. Thread names are a QNX Neutrino extension.

Register set

Each thread has its own instruction pointer (IP), stack pointer (SP), and other processor-specific register context.

Stack

Each thread executes on its own stack, stored within the address space of its process.

Signal mask

Each thread has its own signal mask.

Thread local storage

A thread has a system-defined data area called “thread local storage” (TLS). The TLS is used to store “per-thread” information (such as tid, pid, stack base, [errno](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/e/errno.html), and thread-specific key/data bindings). The TLS doesn't need to be accessed directly by a user application. A thread can have user-defined data associated with a thread-specific data key.

Cancellation handlers

Callback functions that are executed when the thread terminates.

Thread-specific data, implemented in the pthread library and stored in the TLS, provides a mechanism for associating a process global integer key with a unique per-thread data value. To use thread-specific data, you first create a new key and then bind a unique data value to the key (per thread). The data value may, for example, be an integer or a pointer to a dynamically allocated data structure. Subsequently, the key can return the bound data value per thread.

A typical application of thread-specific data is for a thread-safe function that needs to maintain a context for each calling thread.

![](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.sys_arch/images/matrix.png) 
Figure 1. Sparse matrix (tid,key) to value mapping.

You use the following functions to create and manipulate this data:

|Function|Description|
|---|---|
|[pthread_key_create()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_key_create.html)|Create a data key with destructor function|
|[pthread_key_delete()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_key_delete.html)|Destroy a data key|
|[pthread_setspecific()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_setspecific.html)|Bind a data value to a data key|
|[pthread_getspecific()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_getspecific.html)|Return the data value bound to a data key|

### Related concepts  

[Threads and processes (Getting Started with QNX Neutrino)](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.getting_started/topic/s1_procs_Threads_and_processes.html "Threads and processes (Getting Started with QNX Neutrino)")

[Programming Overview (QNX Neutrino Programmer's Guide)](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.prog/topic/overview.html "Programming Overview (QNX Neutrino Programmer's Guide)")

[Processes (QNX Neutrino Programmer's Guide)](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.prog/topic/process.html "Processes (QNX Neutrino Programmer's Guide)")
