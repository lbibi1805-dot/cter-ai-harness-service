---
title: "mprotect()"
category: "IPC"
source: "https://www.qnx.com/developers/docs/7.0.0/"
tags: [qnx, ipc, message-passing]
---

# mprotect()
_Change memory protection_

## Synopsis:

```c
#include <sys/mman.h>

int mprotect( void * addr, 
              size_t len,
              int prot );
```

## Arguments:

**addr** —

The beginning of the range of addresses whose protection you want to change.

**len** —

The length of the range of addresses, in bytes.

**prot** —

The new access capabilities for the mapped memory region(s). You can combine the following bits, which are defined in <sys/mman.h>:

- PROT_EXEC — the region can be executed.

    In order to successfully use this flag:

    - Your process must have the PROCMGR_AID_PROT_EXEC ability enabled.
    - If the calling process has any privileged abilities enabled, then any memory-mapped files in the region must be from a trusted filesystem. For more information about trusted filesystems, see [pathtrust](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.utilities/topic/p/pathtrust.html) in the Utilities Reference.

    For more information about abilities, see [procmgr_ability()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/procmgr_ability.html "Control a process's ability to perform certain operations").

- PROT_NOCACHE — disable caching of the region (for example, to access dual ported memory).
- PROT_NONE — the region can't be accessed.
- PROT_READ — the region can be read.
- PROT_WRITE — the region can be written.

    In order to simultaneously set PROT_EXEC and PROT_WRITE, your process must have the PROCMGR_AID_PROT_WRITE_AND_EXEC ability enabled (in addition to PROCMGR_AID_PROT_EXEC). For more information, see [procmgr_ability()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/procmgr_ability.html "Control a process's ability to perform certain operations").

## Library:

libc

Use the -l c option to [qcc](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.utilities/topic/q/qcc.html) to link against this library. This library is usually included automatically.

## Description:

The mprotect() function changes the access protections on any mappings residing in the range starting at addr, and continuing for len bytes.

## Returns:

0

Success.

-1

An error occurred ([errno](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/e/errno.html "Thread-local error variable") is set).

If mprotect() fails, the protections on some of the pages in the address range starting at addr and continuing for len bytes may have been changed.

## Errors:

### `EACCES`

One of the following occurred:

- The memory object wasn't opened for read, regardless of the protection specified.
- The memory object wasn't opened for write, and you specified PROT_WRITE for a MAP_SHARED type mapping.
- You specified PROT_EXEC for a memory-mapped file mapping, the file doesn't have execute permission for the client process, and procnto was started with the -mX option.

### `EAGAIN`

The prot argument specifies PROT_WRITE on a MAP_PRIVATE mapping, and there's insufficient memory resources to reserve for locking the private pages (if required).

### `ENOMEM`

The addresses in the range starting at addr and continuing for len bytes are outside the range allowed for the address space of a process, or specify one or more pages that are not mapped.

The prot argument specifies PROT_WRITE on a MAP_PRIVATE mapping, and locking the private pages (if required) would need more space than the system can supply to reserve for doing so.

### `ENOSYS`

The function mprotect() isn't supported by this implementation.

### `EPERM`

The calling process doesn't have the required permission (see [procmgr_ability()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/procmgr_ability.html "Control a process's ability to perform certain operations")), or it attempted to set PROT_EXEC for a region of memory covered by an untrusted memory-mapped file.

## Classification:

[POSIX 1003.1](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/summary.html#summary__CLASSIFICATION)

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

[munmap()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/munmap.html "Unmap previously mapped addresses")

[procmgr_ability()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/procmgr_ability.html "Control a process's ability to perform certain operations")

[shm_open()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/s/shm_open.html "Open a shared memory object")

[shm_unlink()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/s/shm_unlink.html "Remove a shared memory object")

[pathtrust (Utilities Reference)](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.utilities/topic/p/pathtrust.html "pathtrust (Utilities Reference)")
