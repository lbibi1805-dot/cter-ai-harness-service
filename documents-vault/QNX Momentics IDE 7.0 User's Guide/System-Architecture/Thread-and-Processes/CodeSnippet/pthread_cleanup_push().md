---
title: "pthread_cleanup_push()"
category: "Thread-and-Processes"
source: "https://www.qnx.com/developers/docs/7.0.0/"
tags: [qnx, thread, process, pthread]
---

# pthread_cleanup_push()
_Push a function onto a thread's cancellation-cleanup stack_

## Synopsis:

```c
#include <pthread.h>

void pthread_cleanup_push( void (routine)(void*),
                           void* arg );
```

## Arguments:

**routine** —

The handler that you want to push onto the thread's stack.

**arg** —

A pointer to whatever data you want to pass to the function when it's called.

## Library:

libc

Use the -l c option to [qcc](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.utilities/topic/q/qcc.html) to link against this library. This library is usually included automatically.

## Description:

The pthread_cleanup_push() function pushes the given cancellation-cleanup handler routine onto the calling thread's cancellation-cleanup stack.

The cancellation-cleanup handler is popped from the stack and invoked with argument arg when the thread:

- exits (i.e., calls [pthread_exit()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_exit.html "Terminate a thread"))
- acts on a cancellation request
- calls [pthread_cleanup_pop()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_cleanup_pop.html "Pop a function off of a thread's cancellation-cleanup stack") with a nonzero argument

The pthread_cleanup_push() macro expands to a few lines of code that start with an opening brace ({), but don't have a matching closing brace (}). You must pair pthread_cleanup_push() with pthread_cleanup_pop() within the same lexical scope.

## Examples:

```c
Use a cancellation cleanup handler to free resources, such as a mutex, when a thread is terminated:

#include <pthread.h>

pthread_mutex_t lock = PTHREAD_MUTEX_INITIALIZER;

void unlock( void * arg )
{
   pthread_mutex_unlock( &lock );
}

void * function( void * arg )
{
   while( 1 )
   {
      pthread_mutex_lock( &lock );
      pthread_cleanup_push( &unlock, NULL );

      /*
       Any of the possible cancellation points could
       go here.
      */
      pthread_testcancel();

      pthread_cleanup_pop( 1 );
   }
}
```

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

[pthread_cleanup_pop()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_cleanup_pop.html "Pop a function off of a thread's cancellation-cleanup stack")

[pthread_cancel()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_cancel.html "Cancel a thread")

[pthread_exit()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/pthread_exit.html "Terminate a thread")
