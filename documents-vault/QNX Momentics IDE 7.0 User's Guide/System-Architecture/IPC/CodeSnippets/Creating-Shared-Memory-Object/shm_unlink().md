---
title: "shm_unlink()"
category: "IPC"
source: "https://www.qnx.com/developers/docs/7.0.0/"
tags: [qnx, ipc, message-passing]
---

# shm_unlink()
Remove a shared memory object_

## Synopsis:

```c
#include <sys/mman.h>

int shm_unlink( const char * name );
```

## Arguments:

**name** —

The name of the shared memory object that you want to remove.

## Library:

libc

Use the -l c option to [qcc](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.utilities/topic/q/qcc.html) to link against this library. This library is usually included automatically.

## Description:

The shm_unlink() function removes the name of the shared memory object specified by name. After removing the name, you can't use [shm_open()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/s/shm_open.html "Open a shared memory object") to access the object.

This function doesn't affect any references to the shared memory object (i.e., file descriptors or memory mappings). If more than one reference to the shared memory object exists, then the link count is decremented, but the shared memory segment isn't actually removed until you remove all open and map references to it.

## Returns:

0

Success.

-1

An error occurred ([errno](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/e/errno.html "Thread-local error variable") is set).

## Errors:

### `EACCES`

Permission to unlink the shared memory object is denied.

### `ELOOP`

Too many levels of symbolic links or prefixes.

### `ENAMETOOLONG`

The length of the name argument exceeds NAME_MAX.

### `ENOENT`

The named shared memory object doesn't exist, or the name argument points to an empty string.

### `ENOSYS`

The shm_unlink() function isn't supported by this implementation.

## Examples:

See [shm_open()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/s/shm_open.html "Open a shared memory object").

## Classification:

[POSIX 1003.1 SHM](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/summary.html#summary__CLASSIFICATION)

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

[mprotect()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/mprotect.html "Change memory protection")

[shm_ctl(), shm_ctl_special()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/s/shm_ctl.html "Give special attributes to a shared memory object")

[shm_open()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/s/shm_open.html "Open a shared memory object")
