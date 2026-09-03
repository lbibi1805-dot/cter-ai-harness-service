---
title: "pthread_attr_setstackaddr()"
category: "Thread-and-Processes"
source: "https://www.qnx.com/developers/docs/7.0.0/"
tags: [qnx, thread, process, pthread]
---

# pthread_attr_setstackaddr()
_Set the thread stack address attribute_

## Synopsis:

```c
#include <pthread.h>

int pthread_attr_setstackaddr( pthread_attr_t * attr,
                               void * stackaddr );
```

## Arguments:

**attr** —

A pointer to the pthread_attr_t structure that defines the attributes to use when creating new threads. For more information, see [pthread_attr_init()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_attr_init.html "Initialize a thread-attribute object").

**stackaddr** —

A pointer to the block of memory that you want a new thread to use as its stack.

## Library:

libc

Use the -l c option to [qcc](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.utilities/topic/q/qcc.html) to link against this library. This library is usually included automatically.

## Description:

The pthread_attr_setstackaddr() function sets the thread stack address attribute in the attribute object attr to stackaddr. If you call this function, you must also call [pthread_attr_setstacksize()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_attr_setstacksize.html "Set the thread stack-size attribute") to set the stack size. Or, you can call [pthread_attr_setstack()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_attr_setstack.html "Set the thread-creation stack attributes") to set both attributes at the same time.

The default value for the thread stack address attribute is NULL. A thread created with a NULL stack address attribute will have a stack dynamically allocated by the system of minimum size PTHREAD_STACK_MIN. If the system allocates a stack, it reclaims the space when the thread terminates. If you allocate a stack, you must free it.

- If you provide a stack, the guardsize member of the pthread_attr_t structure is ignored, and there's no automatic stack overflow protection for the thread. You can provide overflow protection by creating an inaccessible guard page at the end of the stack (i.e. immediately before the lowest address). By inaccessible, we mean it should be assigned the PROT_NONE access type; for more information, see the [mmap()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/mmap.html "Map a memory region into a process's address space") reference.
- The system uses some of the provided stack for objects such as thread local storage and an initial stack frame, so less than the entire buffer is available to the thread.

## Returns:

### `EOK`

Success.

## Classification:

[Standard Unix; removed from POSIX.1-2008](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/summary.html#summary__CLASSIFICATION)

> [!info] Safety — Classification
>
> | Safety | Value |
> |---|---|
> |Cancellation point|No|
> |Interrupt handler|No|
> |Signal handler|Yes|
> |Thread|Yes|

## Caveats:

The QNX Neutrino interpretation of PTHREAD_STACK_MIN is enough memory to run a thread that does nothing:

void nothingthread( void )
{
    return;
}

### Related concepts  

[Processes and Threads (Getting Started with QNX Neutrino)](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.getting_started/topic/s1_procs.html "Processes and Threads (Getting Started with QNX Neutrino)")

[Stack allocation (QNX Neutrino Programmer's Guide)](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.prog/topic/process_stack.html "Stack allocation (QNX Neutrino Programmer's Guide)")

### Related reference  

[pthread_attr_getstack()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_attr_getstack.html "Get the thread-creation stack attributes")

[pthread_attr_getstackaddr()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_attr_getstackaddr.html "Get the thread stack address attribute")

[pthread_attr_setstack()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_attr_setstack.html "Set the thread-creation stack attributes")

[pthread_attr_init()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_attr_init.html "Initialize a thread-attribute object")

[pthread_create()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_create.html "Create a thread")
