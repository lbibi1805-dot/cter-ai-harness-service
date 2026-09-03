---
title: "msync()"
category: "IPC"
source: "https://www.qnx.com/developers/docs/7.0.0/"
tags: [qnx, ipc, message-passing]
---

# msync()
_Synchronize memory with physical storage_

## Synopsis:

```c
#include <sys/mman.h>

int msync( void * addr, 
           size_t len, 
           int flags );
```

## Arguments:

**addr** —

The beginning of the range of addresses that you want to synchronize.

**len** —

The length of the range of addresses, in bytes.

**flags** —

A bitwise inclusive OR of one or more of the following flags:

- MS_ASYNC — perform asynchronous writes. The function returns immediately once all the write operations are initiated or queued for servicing.
- MS_CACHE_ONLY (QNX Neutrino extension; QNX Neutrino Core OS 6.3.2 or later) — now that QNX Neutrino includes POSIX support for memory-mapped files, msync() performs its intended operation of writing changes in the mapped memory back to the underlying file. Specify this bit if you want to perform the QNX Neutrino extension of having the function flush or invalidate the data cache (via the MS_ASYNC, MS_SYNC, or MS_INVALIDATE flags), instead of the POSIX standard behavior.
- MS_INVALIDATE — invalidate cached data. Invalidates all cached copies of mapped data that are inconsistent with the permanent storage locations such that subsequent references obtain data that was consistent with the permanent storage locations sometime between the call to msync() and the first subsequent memory reference to the data.
- MS_INVALIDATE_ICACHE (QNX Neutrino extension) — if you're dynamically modifying code, use this flag to make sure that the new code is what will be executed.
- MS_CLEAN_ONLY (QNX Neutrino extension; QNX Neutrino 7.0 or later) — operate only on clean pages.
- MS_SYNC — perform synchronous writes. The function doesn't return until all write operations are completed as defined for synchronized I/O data integrity completion.

You can specify at most one of MS_ASYNC and MS_SYNC, not both.

## Library:

libc

Use the -l c option to [qcc](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.utilities/topic/q/qcc.html) to link against this library. This library is usually included automatically.

## Description:

The msync() function writes all modified data to permanent storage locations, if any, in those whole pages containing any part of the address space of the process starting at address addr and continuing for len bytes. The msync() function is used with memory mapped files. If no such storage exists, msync() need not have any effect. If requested, the msync() function then invalidates cached copies of data.

For mappings to files, this function ensures that all write operations are completed as defined for synchronized I/O data integrity completion.

Mappings to files aren't implemented on all filesystems.

If you call msync() on MAP_PRIVATE mappings, any modified data isn't written to the underlying object and doesn't cause such data to be made visible to other processes.

The behavior of msync() is undefined if the mapping wasn't established by a call to [mmap()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/mmap.html "Map a memory region into a process's address space").

If msync() causes any write to a file, the file's st_ctime and st_mtime fields are marked for update.

## Returns:

0

Success.

-1

An error occurred ([errno](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/e/errno.html "Thread-local error variable") is set).

## Errors:

### `EBUSY`

Some or all of the addresses in the range starting at addr and continuing for len bytes are locked, and MS_INVALIDATE is specified.

### `EINTR`

The call was interrupted by a signal.

### `EINVAL`

Invalid flags value.

### `ENOMEM`

The addresses in the range starting at addr and continuing for len bytes are outside the range allowed for the address space of a process or specify one or more pages that aren't mapped.

## Examples:

See the entry for [mmap()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/mmap.html "Map a memory region into a process's address space").

## Classification:

[POSIX 1003.1 SIO](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/summary.html#summary__CLASSIFICATION)

> [!info] Safety — Classification
>
> | Safety | Value |
> |---|---|
> |Cancellation point|Yes|
> |Interrupt handler|No|
> |Signal handler|Yes|
> |Thread|Yes|

## Caveats:

MS_INVALIDATE_ICACHE and MS_CACHE_ONLY are QNX Neutrino extensions. The behavior of this function changed in the QNX Neutrino Core OS 6.3.2; to get the previous behavior of just data-cache operations, add the MS_CACHE_ONLY flag to the call in addition to MS_ASYNC, MS_SYNC, or MS_INVALIDATE.

### Related reference  

[mmap(), mmap64()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/mmap.html "Map a memory region into a process's address space")

[munmap()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/munmap.html "Unmap previously mapped addresses")

[sysconf()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/s/sysconf.html "Return the value of a configurable system limit or option")
