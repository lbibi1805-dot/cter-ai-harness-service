---
title: "Typed memory"
category: "IPC"
source: "https://www.qnx.com/developers/docs/7.0.0/"
tags: [qnx, ipc, message-passing]
---

# Typed memory

Typed memory is POSIX functionality defined in the 1003.1 specification. It's part of the advanced realtime extensions, and the manifests are located in the <sys/mman.h> header file.

Typed memory adds the following functions to the C library:

[posix_typed_mem_open()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/posix_typed_mem_open.html)

Open a typed memory object. This function returns a file descriptor, which you can then pass to [mmap()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/mmap.html) to establish a memory mapping of the typed memory object.

[posix_typed_mem_get_info()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/posix_typed_mem_get_info.html)

Get information (currently the amount of available memory) about a typed memory object.

POSIX typed memory provides an interface to open memory objects (which are defined in an OS-specific fashion) and perform mapping operations on them. It's useful in providing an abstraction between BSP- or board-specific address layouts and device drivers or user code.

- **[Implementation-defined behavior](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.sys_arch/topic/ipc_Typed_memory_implementation.html)**  
    POSIX specifies that typed memory pools (or objects) are created and defined in an implementation-specific fashion.
- **[Practical examples](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.sys_arch/topic/ipc_Typed_memory_examples.html)**  
    Here are some examples of how you could use typed memory.

### Related reference  

[mmap()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/mmap.html "mmap()")

[posix_typed_mem_get_info()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/posix_typed_mem_get_info.html "posix_typed_mem_get_info()")

[posix_typed_mem_open()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/posix_typed_mem_open.html "posix_typed_mem_open()")

[as_add() (Building Embedded Systems)](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.building/topic/startup_lib/as_add.html "as_add() (Building Embedded Systems)")

[as_add_containing() (Building Embedded Systems)](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.building/topic/startup_lib/as_add_containing.html "as_add_containing() (Building Embedded Systems)")
