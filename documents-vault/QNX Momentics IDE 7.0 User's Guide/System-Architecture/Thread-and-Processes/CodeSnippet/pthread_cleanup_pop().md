---
title: "pthread_cleanup_pop()"
category: "Thread-and-Processes"
source: "https://www.qnx.com/developers/docs/7.0.0/"
tags: [qnx, thread, process, pthread]
---

# pthread_cleanup_pop()
_Pop a function off of a thread's cancellation-cleanup stack_

## Synopsis:

```c
#include <pthread.h>

void pthread_cleanup_pop( int execute );
```

## Arguments:

**execute** —

Zero if you don't want to execute the handler; nonzero if you do.

## Library:

libc

Use the -l c option to [qcc](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.utilities/topic/q/qcc.html) to link against this library. This library is usually included automatically.

## Description:

The pthread_cleanup_pop() macro pops the top cancellation-cleanup handler from the calling thread's cancellation-cleanup stack and invokes the handler if execute is nonzero.

The pthread_cleanup_pop() macro expands to a few lines of code that end with a closing brace (}), but don't have a matching opening brace ({). You must pair pthread_cleanup_pop() with [pthread_cleanup_push()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_cleanup_push.html "Push a function onto a thread's cancellation-cleanup stack") within the same lexical scope.

## Examples:

See [pthread_cleanup_push()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_cleanup_push.html "Push a function onto a thread's cancellation-cleanup stack").

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

[pthread_cleanup_push()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_cleanup_push.html "Push a function onto a thread's cancellation-cleanup stack")

[pthread_cancel()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_cancel.html "Cancel a thread")

[pthread_exit()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_exit.html "Terminate a thread")
