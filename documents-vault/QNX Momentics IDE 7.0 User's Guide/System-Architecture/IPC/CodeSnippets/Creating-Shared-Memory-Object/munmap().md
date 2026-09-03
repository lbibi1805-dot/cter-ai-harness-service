---
title: "munmap()"
category: "IPC"
source: "https://www.qnx.com/developers/docs/7.0.0/"
tags: [qnx, ipc, message-passing]
---

# munmap()
_Unmap previously mapped addresses_

## Synopsis:

```c
#include <sys/mman.h>

int munmap( void * addr,
            size_t len );
```

## Arguments:

**addr** —

The beginning of the range of addresses that you want to unmap.

**len** —

The length of the range of addresses, in bytes.

## Library:

libc

Use the -l c option to [qcc](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.utilities/topic/q/qcc.html) to link against this library. This library is usually included automatically.

## Description:

The munmap() function removes any mappings for pages in the address range starting at addr and continuing for len bytes, rounded up to the next multiple of the page size. References to unmapped pages cause a SIGSEGV signal to be set on the process.

If there are no mappings in the specified address range, then munmap() has no effect.

## Returns:

0

Success.

-1

Failure; [errno](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/e/errno.html "Thread-local error variable") is set.

## Errors:

### `EINVAL`

The addresses in the specified range are outside the range allowed for the address space of a process.

### `EINTR`

The call was interrupted by a signal.

### `ENOMEM`

The memory manager fails to allocate memory to handle a user's munmap() request. This allocation of memory is necessary for internal structures to represent the new state of mapped memory.

## Classification:

[POSIX 1003.1 SHM|TYM](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/summary.html#summary__CLASSIFICATION)

> [!info] Safety — Classification
>
> | Safety | Value |
> |---|---|
> |Cancellation point|No|
> |Interrupt handler|No|
> |Signal handler|Yes|
> |Thread|Yes|

### Related reference  

[mmap(), mmap64()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/mmap.html "Map a memory region into a process's address space")

[mprotect()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/mprotect.html "Change memory protection")

[msync()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/msync.html "Synchronize memory with physical storage")

[munmap_flags()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/munmap_flags.html "Unmap previously mapped addresses, exercising more control than possible with munmap()")

[shm_open()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/s/shm_open.html "Open a shared memory object")

[shm_unlink()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/s/shm_unlink.html "Remove a shared memory object")
