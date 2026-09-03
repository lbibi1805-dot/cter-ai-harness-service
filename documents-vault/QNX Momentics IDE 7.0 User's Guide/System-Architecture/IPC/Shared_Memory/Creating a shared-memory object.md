---
title: "Creating a shared-memory object"
category: "IPC"
source: "https://www.qnx.com/developers/docs/7.0.0/"
tags: [qnx, ipc, message-passing]
---

# Creating a shared-memory object

Multiple threads within a process share the memory of that process. To share memory between processes, you must first create a shared-memory region and then map that region into your process's address space. Shared-memory regions are created and manipulated using the following calls:

|Function|Description|Classification|
|---|---|---|
|[shm_open()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/s/shm_open.html)|Open (or create) a shared-memory region.|POSIX|
|[close()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/c/close.html)|Close a shared-memory region.|POSIX|
|[mmap()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/mmap.html)|Map a shared-memory region into a process's address space.|POSIX|
|[munmap()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/munmap.html)|Unmap a shared-memory region from a process's address space.|POSIX|
|[munmap_flags()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/munmap_flags.html)|Unmap previously mapped addresses, exercising more control than possible with munmap()|QNX Neutrino|
|[mprotect()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/mprotect.html)|Change protections on a shared-memory region.|POSIX|
|[msync()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/msync.html)|Synchronize memory with physical storage.|POSIX|
|[shm_ctl()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/s/shm_ctl.html), [shm_ctl_special()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/s/shm_ctl.html)|Give special attributes to a shared-memory object.|QNX Neutrino|
|[shm_unlink()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/s/shm_unlink.html)|Remove a shared-memory region.|POSIX|

POSIX shared memory is implemented in the QNX Neutrino RTOS via the process manager (procnto). The above calls are implemented as messages to procnto (see the [Process Manager](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.sys_arch/topic/proc.html "The process manager is capable of creating multiple POSIX processes (each of which may contain multiple POSIX threads).") chapter in this book).

The shm_open() function takes the same arguments as [open()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/o/open.html) and returns a file descriptor to the object. As with a regular file, this function lets you create a new shared-memory object or open an existing shared-memory object.

You must open the file descriptor for reading; if you want to write in the memory object, you also need write access, unless you specify a private (MAP_PRIVATE) mapping.

When a new shared-memory object is created, the size of the object is set to zero. To set the size, you use [ftruncate()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/f/ftruncate.html)—the very same function used to set the size of a file—or shm_ctl().

### Related concepts  

[Threads in independent situations (Getting Started with QNX Neutrino)](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.getting_started/topic/s1_procs_independent.html "Threads in independent situations (Getting Started with QNX Neutrino)")

### Related reference  

[close()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/c/close.html "close()")

[ftruncate()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/f/ftruncate.html "ftruncate()")

[mmap()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/mmap.html "mmap()")

[mprotect()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/mprotect.html "mprotect()")

[msync()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/msync.html "msync()")

[munmap()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/munmap.html "munmap()")

[munmap_flags()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/munmap_flags.html "munmap_flags()")

[shm_ctl(), shm_ctl_special()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/s/shm_ctl.html "shm_ctl(), shm_ctl_special()")

[shm_open()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/s/shm_open.html "shm_open()")

[shm_unlink()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/s/shm_unlink.html "shm_unlink()")

[procnto](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.utilities/topic/p/procnto.html "procnto")
