---
title: "munmap_flags()"
category: "IPC"
source: "https://www.qnx.com/developers/docs/7.0.0/"
tags: [qnx, ipc, message-passing]
---

# munmap_flags()
_Unmap previously mapped addresses, exercising more control than possible with munmap()_

## Synopsis:

```c
#include <sys/mman.h>

int munmap_flags( void * addr,
                  size_t len,
                  unsigned flags );
```

## Arguments:

**addr** —

The beginning of the range of addresses that you want to unmap.

**len** —

The length of the range of addresses, in bytes.

**flags** —

There are no currently defined flags; pass 0 for this argument.

## Library:

libc

Use the -l c option to [qcc](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.utilities/topic/q/qcc.html) to link against this library. This library is usually included automatically.

## Description:

The munmap_flags() function removes any mappings for pages in the address range starting at addr and continuing for len bytes, rounded up to the next multiple of the page size. Subsequent references to these pages cause a SIGSEGV signal to be set on the process.

If there are no mappings in the specified address range, then munmap_flags() has no effect.

This function was added in the QNX Neutrino Core OS 6.3.2.

If you specify 0 for the flags, munmap_flags() is the same as [munmap()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/munmap.html "Unmap previously mapped addresses").

## Returns:

0

Success.

-1

Failure; [errno](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/e/errno.html "Thread-local error variable") is set.

## Errors:

### `EINVAL`

The addresses in the specified range are outside the range allowed for the address space of a process.

### `ENOSYS`

The function munmap_flags() isn't supported by this implementation.

## Classification:

[QNX Neutrino](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/summary.html#summary__CLASSIFICATION)

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

[munmap()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/munmap.html "Unmap previously mapped addresses")

[shm_open()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/s/shm_open.html "Open a shared memory object")

[shm_unlink()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/s/shm_unlink.html "Remove a shared memory object")

[procnto* (Utilities Reference)](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.utilities/topic/p/procnto.html "procnto* (Utilities Reference)")
