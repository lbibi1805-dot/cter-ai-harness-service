---
title: "posix_typed_mem_get_info()"
category: "IPC"
source: "https://www.qnx.com/developers/docs/7.0.0/"
tags: [qnx, ipc, message-passing]
---

# posix_typed_mem_get_info()
_Get information about a typed memory object_

## Synopsis:

```c
#include <sys/mman.h>

int posix_typed_mem_get_info(
        int fildes,
        struct posix_typed_mem_info *info);
```

## Arguments:

**fildes** —

The file descriptor for the typed memory object that you want to query, returned by a call to [posix_typed_mem_open()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/posix_typed_mem_open.html "Open a typed memory object").

**info** —

A pointer to a posix_typed_mem_info structure where the function can store the information.

## Library:

libc

Use the -l c option to [qcc](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.utilities/topic/q/qcc.html) to link against this library. This library is usually included automatically.

## Description:

The posix_typed_mem_get_info() function queries the typed memory object to obtain the amount of memory currently available. This is particularly important for typed memory objects that may in some cases be scarce resources.

This function was added in the QNX Neutrino Core OS 6.3.2.

The posix_typed_mem_get_info() function stores, in the posix_tmi_length field of the posix_typed_mem_info structure pointed to by info, the maximum length that may be successfully allocated by the typed memory object designated by fildes.

If the typed memory pool is a shared resource, some form of mutual-exclusion or synchronization may be required while querying and allocating it, to prevent race conditions.

The maximum length is dynamic; it's valid only while the current mapping of the corresponding typed memory pool remains unchanged. It takes into account the POSIX_TYPED_MEM_ALLOCATE or POSIX_TYPED_MEM_ALLOCATE_CONTIG flag specified when the typed memory object was opened.

As a QNX Neutrino extension, if fildes represents a typed memory object opened with neither POSIX_TYPED_MEM_ALLOCATE nor POSIX_TYPED_MEM_ALLOCATE_CONTIG, the function sets info->posix_tmi_length to 0.

## Returns:

0

Success.

### `EBADF`

The fildes argument isn't a valid open file descriptor.

### `ENODEV`

The fildes isn't connected to a memory object supported by this function.

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

[posix_mem_offset(), posix_mem_offset64()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/posix_mem_offset.html "Get the offset and length of a mapped memory block")

[posix_typed_mem_open()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/posix_typed_mem_open.html "Open a typed memory object")
