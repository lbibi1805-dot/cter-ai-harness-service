---
title: "mmap()"
category: "IPC"
source: "https://www.qnx.com/developers/docs/7.0.0/"
tags: [qnx, ipc, message-passing]
---

# mmap()
Once you have a file descriptor to a shared-memory object, you use the mmap() function to map the object, or part of it, into your process's address space.

The [mmap()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/mmap.html) function is the cornerstone of memory management within QNX Neutrino and deserves a detailed discussion of its capabilities.

You can also use mmap() to map files and typed memory objects into your process's address space.

The mmap() function is defined as follows:

void * mmap( void *where_i_want_it,
             size_t length,
             int memory_protections,
             int mapping_flags,
             int fd,
             off_t offset_within_shared_memory );

In simple terms this says: “Map in length bytes of shared memory at offset_within_shared_memory in the shared-memory object associated with fd.”

The mmap() function will try to place the memory at the address where_i_want_it in your address space. The memory will be given the protections specified by memory_protections and the mapping will be done according to the mapping_flags.

The three arguments fd, offset_within_shared_memory, and length define a portion of a particular shared object to be mapped in. It's common to map in an entire shared object, in which case the offset will be zero and the length will be the size of the shared object in bytes. On an Intel processor, the length will be a multiple of the page size, which is 4096 bytes.

![](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.sys_arch/images/mmap.png) Figure 1. Mapping memory with mmap().

The return value of mmap() will be the address in your process's address space where the object was mapped. The argument where_i_want_it is used as a hint by the system to where you want the object placed. If possible, the object will be placed at the address requested. Most applications specify an address of zero, which gives the system free rein to place the object where it wishes.

The following protection types may be specified for memory_protections:

|Manifest|Description|
|---|---|
|PROT_EXEC|Memory may be executed.|
|PROT_NOCACHE|Memory should not be cached.|
|PROT_NONE|No access allowed.|
|PROT_READ|Memory may be read.|
|PROT_WRITE|Memory may be written.|

You should use the PROT_NOCACHE manifest when you're using a shared-memory region to gain access to dual-ported memory that may be modified by hardware (e.g., a video frame buffer or a memory-mapped network or communications board). Without this manifest, the processor may return “stale” data from a previously cached read.

The mapping_flags determine how the memory is mapped. These flags are broken down into two parts—the first part is a type and must be specified as one of the following:

|Map type|Description|
|---|---|
|MAP_SHARED|The mapping may be shared by many processes; changes are propagated back to the underlying object.|
|MAP_PRIVATE|The mapping is private to the calling process; changes _aren't_ propagated back to the underlying object. The mmap() function allocates system RAM and makes a copy of the object.|

The MAP_SHARED type is the one to use for setting up shared memory between processes; MAP_PRIVATE has more specialized uses.

Don't have a shared, writable mapping to a file that you're simultaneously accessing via [write()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/w/write.html). The interaction between the two methods isn't well defined and may give unexpected results.

You can OR a number of flags into the above type to further define the mapping. These are described in detail in the [mmap()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/mmap.html) entry in the QNX Neutrino C Library Reference. A few of the more interesting flags are:

MAP_ANON

Map anonymous memory that isn't associated with any file descriptor; you must set the fd parameter to NOFD. The mmap() function allocates the memory and fills it with zeros.

You commonly use MAP_ANON with MAP_SHARED to create a shared memory area for forked applications. You can use MAP_ANON as the basis for a page-level memory allocator.

MAP_FIXED

Map the object to the address specified by where_i_want_it. If a shared-memory region contains pointers within it, then you may need to force the region at the same address in all processes that map it. This can be avoided by using offsets within the region in place of direct pointers.

MAP_PHYS

This flag indicates that you wish to deal with physical memory. The fd parameter should be set to NOFD. When used without MAP_ANON, the offset_within_shared_memory specifies the exact physical address to map (e.g., for video frame buffers).

If used with MAP_ANON, then physically contiguous memory is allocated (e.g., for a DMA buffer). You typically use this combination with MAP_SHARED.

Using the mapping flags described above, a process can easily share memory between processes:

/* Map in a shared memory region */
fd = shm_open("datapoints", O_RDWR);
addr = mmap(0, len, PROT_READ|PROT_WRITE, MAP_SHARED, fd, 0);

or allocate a DMA buffer for a bus-mastering PCI network card:

/* Allocate a physically contiguous buffer */
addr = mmap(0, 262144, PROT_READ | PROT_WRITE | PROT_NOCACHE,
            MAP_SHARED | MAP_PHYS | MAP_ANON, NOFD, 0);

You can unmap all or part of a shared-memory object from your address space using [munmap()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/munmap.html). This primitive isn't restricted to unmapping shared memory—it can be used to unmap any region of memory within your process. When used in conjunction with the MAP_ANON flag to [mmap()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/mmap.html), you can easily implement a private page-level allocator/deallocator.

You can change the protections on a mapped region of memory using [mprotect()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/mprotect.html). Like munmap(), mprotect() isn't restricted to shared-memory regions—it can change the protection on any region of memory within your process.

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
