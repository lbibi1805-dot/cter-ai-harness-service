---
title: "posix_typed_mem_open()"
category: "IPC"
source: "https://www.qnx.com/developers/docs/7.0.0/"
tags: [qnx, ipc, message-passing]
---

# posix_typed_mem_open()
_Open a typed memory object_

## Synopsis:

```c
#include <sys/mman.h>
#include <fcntl.h>

int posix_typed_mem_open( const char * name,
                          int oflag,
                          int tflag);
```

## Arguments:

**name** —

A pointer to the string that specifies the typed memory object.

**oflag** —

The access mode to use; one of:

### `O_RDONLY`

Open for read access only.

### `O_WRONLY`

Open for write access only.

### `O_RDWR`

Open for read or write access.

**tflag** —

Flags that determine how the typed memory object behaves when mapped; at most one of:

### `POSIX_TYPED_MEM_ALLOCATE`

Allocate on mmap().

### `POSIX_TYPED_MEM_ALLOCATE_CONTIG`

Allocate contiguously on mmap().

### `POSIX_TYPED_MEM_MAP_ALLOCATABLE`

Map on mmap() without affecting the availability for allocation.

## Library:

libc

Use the -l c option to [qcc](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.utilities/topic/q/qcc.html) to link against this library. This library is usually included automatically.

## Description:

The posix_typed_mem_open() function establishes a connection between the typed memory object specified by the name and a file descriptor. It creates an open file description that refers to the typed memory object and a file descriptor that refers to the open file description.

This function was added in the QNX Neutrino Core OS 6.3.2.

The names of typed memory regions are derived directly from the names of the asinfo segments. The asinfo section itself describes a hierarchy, and so the naming of typed memory object is a hierarchy.

The posix_typed_mem_open() function resolves the name as follows:

1. If the name starts with a leading /, an exact match is done.
2. The name may contain intermediate / characters. These are considered as path component separators. If multiple path components are specified, they're matched from the bottom up (the opposite of the way filenames are resolved).
3. If the name doesn't start with a leading /, a tail match is done on the pathname components specified.
4. The name can include ampersands and vertical bars (& and |) between segments to specify intersections and unions, respectively. A name can contain an arbitrary number of intersections and unions; they're evaluated from left to right. Parentheses aren't supported.

For more information, see “[Typed memory](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.sys_arch/topic/ipc_Typed_memory.html)” in the Interprocess Communication (IPC) chapter of the System Architecture guide.

The file descriptor is used by other functions to refer to that typed memory object.

The setting of tflag affects what happens when you call [mmap()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/mmap.html "Map a memory region into a process's address space") with the file descriptor for the typed memory object:

POSIX_TYPED_MEM_ALLOCATE

The mmap() function allocates and maps typed memory from the specified typed memory pool. The allocated memory is either a previously unallocated contiguous area of the typed memory pool, or several noncontiguous previously unallocated areas (mapped to a contiguous portion of the process address space).

POSIX_TYPED_MEM_ALLOCATE_CONTIG

The mmap() function allocates and maps a previously unallocated single contiguous area of the typed memory pool (also mapped to a contiguous portion of the process address space).

Neither POSIX_TYPED_MEM_ALLOCATE nor POSIX_TYPED_MEM_ALLOCATE_CONTIG

The mmap() function maps an application-chosen area from the specified typed memory pool.

The mapped area is unavailable for allocation until all processes unmap it.

POSIX_TYPED_MEM_MAP_ALLOCATABLE

The mmap() function maps an application-chosen area from the specified typed memory pool without affecting the availability of that area for allocation; that is, mapping such an object leaves each byte of the mapped area unallocated if it was unallocated prior to the mapping, or allocated if it was allocated prior to the mapping.

If tflag is 0 or POSIX_TYPED_MEM_MAP_ALLOCATABLE, the offset parameter to mmap() specifies the starting physical address in the typed memory region; if the typed memory region is discontiguous (multiple asinfo entries), the allowed offset values are also discontiguous and don't start at zero as they do for shared memory objects. If you specify a [paddr, paddr + size) region that falls outside the allowed addresses for the typed memory object, mmap() fails with ENXIO.

The oflag controls what permissions you're allowed to mmap() with. For example, if oflag is O_RDONLY, you can't do a mmap() with MAP_SHARED and PROT_WRITE.

If successful, posix_typed_mem_open() returns a file descriptor for the typed memory object that is the lowest numbered file descriptor not currently open for that process. The open file descriptor is new and isn't shared with any other processes. The FD_CLOEXEC file descriptor flag associated with the new file descriptor is cleared.

The [mmap()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/mmap.html "Map a memory region into a process's address space"), [posix_mem_offset()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/posix_mem_offset.html "Get the offset and length of a mapped memory block"), [posix_typed_mem_get_info()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/posix_typed_mem_get_info.html "Get information about a typed memory object"), [fstat()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/f/fstat.html "Get file information, given a file description"), [dup()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/d/dup.html "Duplicate a file descriptor"), [dup2()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/d/dup2.html "Duplicate a file descriptor, specifying the new descriptor"), and [close()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/c/close.html "Close a file") functions can operate on a file descriptor that posix_typed_mem_open() returns.

As QNX Neutrino extensions:

- [msync()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/msync.html "Synchronize memory with physical storage") flushes and/or invalidates the data and or instruction cache for the specified memory region
- [ftruncate()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/f/ftruncate.html "Truncate a file") and other file operations indicate an error of ENOSYS

## Returns:

A nonnegative integer that represents the lowest-numbered unused file descriptor, or -1 if an error occurred (errno is set).

## Errors:

### `EACCES`

The typed memory object exists, and the permissions specified by oflag are denied.

### `EINTR`

The posix_typed_mem_open() function was interrupted by a signal.

### `EINVAL`

The flags specified in tflag are invalid (more than one of POSIX_TYPED_MEM_ALLOCATE, POSIX_TYPED_MEM_ALLOCATE_CONTIG, and POSIX_TYPED_MEM_MAP_ALLOCATABLE is specified).

### `EMFILE`

All file descriptors available to the process are currently open.

### `ENAMETOOLONG`

The length of the name argument exceeds PATH_MAX, or a pathname component is longer than NAME_MAX.

### `ENFILE`

Too many file descriptors are currently open in the system.

### `ENOENT`

The named typed memory object doesn't exist.

### `EPERM`

The caller lacks the superuser capability to specify the flag POSIX_TYPED_MEM_MAP_ALLOCATABLE in the tflag argument.

## Classification:

[POSIX 1003.1 TYM](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/summary.html#summary__CLASSIFICATION)

> [!info] Safety — Classification
>
> | Safety | Value |
> |---|---|
> |Cancellation point|No|
> |Interrupt handler|No|
> |Signal handler|Yes|
> |Thread|Yes|

### Related concepts  

[Typed memory (System Architecture)](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.sys_arch/topic/ipc_Typed_memory.html "Typed memory (System Architecture)")

### Related reference  

[close()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/c/close.html "Close a file")

[dup()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/d/dup.html "Duplicate a file descriptor")

[dup2()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/d/dup2.html "Duplicate a file descriptor, specifying the new descriptor")

[fstat(), fstat64()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/f/fstat.html "Get file information, given a file description")

[ftruncate(), ftruncate64()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/f/ftruncate.html "Truncate a file")

[mmap(), mmap64()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/mmap.html "Map a memory region into a process's address space")

[msync()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/msync.html "Synchronize memory with physical storage")

[posix_mem_offset(), posix_mem_offset64()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/posix_mem_offset.html "Get the offset and length of a mapped memory block")

[posix_typed_mem_get_info()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/posix_typed_mem_get_info.html "Get information about a typed memory object")
