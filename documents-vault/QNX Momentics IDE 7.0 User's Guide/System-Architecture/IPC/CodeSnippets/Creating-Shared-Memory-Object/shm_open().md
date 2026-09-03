---
title: "shm_open()"
category: "IPC"
source: "https://www.qnx.com/developers/docs/7.0.0/"
tags: [qnx, ipc, message-passing]
---

# shm_open()
_Open a shared memory object_

## Synopsis:

```c
#include <fcntl.h>
#include <sys/mman.h>

int shm_open( const char * name,
              int oflag,
              mode_t mode );
```

## Arguments:

**name** —

The name of the shared memory object that you want to open.

(QNX Neutrino 7.0 or later) As a QNX Neutrino extension, you can specify this as SHM_ANON if you want to create an anonymous shared memory object. For more information, see below.

**oflag** —

A combination of the following bits (defined in <fcntl.h>):

- O_RDONLY — open for read access only.
- O_RDWR — open for read and write access.
- O_CREAT — if the shared memory object exists, this flag has no effect, except as noted under O_EXCL below. Otherwise, the shared memory object is created, and its permissions are set in accordance with the value of mode and the file mode creation mask of the process.
- O_EXCL — if O_EXCL and O_CREAT are set, then shm_open() fails if the shared memory segment exists.

    The check for the existence of the shared memory object, and the creation of the object if it doesn't exist, are atomic with respect to other processes executing shm_open(), naming the same shared memory object with O_EXCL and O_CREAT set.

- O_TRUNC — if the shared memory object exists, and it's successfully opened O_RDWR, the object is truncated to zero length and the mode and owner are unchanged.

**mode** —

The permission bits for the memory object are set to the value of mode, except those bits set in the process's file creation mask. For more information, see the entries for [umask()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/u/umask.html "Set the file-mode creation mask for the process"), and [struct stat](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/s/stat_struct.html "Data structure for information about a file or directory").

## Library:

libc

Use the -l c option to [qcc](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.utilities/topic/q/qcc.html) to link against this library. This library is usually included automatically.

## Description:

The shm_open() function returns a file descriptor that's associated with the shared “memory object” specified by name. This file descriptor is used by other functions to refer to the shared memory object (for example, [mmap()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/mmap.html "Map a memory region into a process's address space"), [mprotect()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/mprotect.html "Change memory protection")). The [FD_CLOEXEC](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/f/fcntl.html#fcntl__F_SETFD) file descriptor flag in fcntl() is set for this file descriptor.

The name argument is interpreted as follows:

|name|Pathname space entry|
|---|---|
|SHM_ANON|—|
|entry|/dev/shmem/CWD/entry|
|/entry|/dev/shmem/entry|

where CWD is the current working directory for the program at the point that it calls shm_open().

The state of the shared memory object, including all data associated with it, persists until the shared memory object is unlinked and all other references are gone.

## Returns:

A nonnegative integer, which is the lowest numbered unused file descriptor, or -1 if an error occurred ([errno](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/e/errno.html "Thread-local error variable") is set).

## Errors:

### `EACCES`

Permission to create the shared memory object is denied.

The shared memory object exists and the permissions specified by oflag are denied, or O_TRUNC is specified and write permission is denied.

### `EEXIST`

O_CREAT and O_EXCL are set, and the named shared memory object already exists.

### `EINTR`

The shm_open() call was interrupted by a signal.

### `EINVAL`

An underlying call to [resmgr_open_bind()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/r/resmgr_open_bind.html "Associate an OCB with an open request") failed.

### `ELOOP`

Too many levels of symbolic links or prefixes.

### `EMFILE`

All file descriptors available to the process are currently open.

### `ENAMETOOLONG`

The length of the name argument exceeds NAME_MAX.

### `ENFILE`

Too many shared memory objects are currently open in the system.

### `ENOENT`

O_CREAT isn't set, and the named shared memory object doesn't exist, or O_CREAT is set and either the name prefix doesn't exist or the name argument points to an empty string.

### `ENOSPC`

There isn't enough space to create the new shared memory object.

### `ENOSYS`

The shm_open() function isn't supported by this implementation.

## Examples:

This example sets up a shared memory object, but doesn't really do anything with it:

```c
#include <stdio.h>
#include <string.h>
#include <fcntl.h>
#include <errno.h>
#include <stdlib.h>
#include <unistd.h>
#include <limits.h>
#include <sys/mman.h>

int main( int argc, char** argv )
{
    int fd;
    unsigned* addr;

    /*
     * In case the unlink code isn't executed at the end
     */
    if( argc != 1 ) {
        shm_unlink( "/bolts" );
        return EXIT_SUCCESS;
    }

    /* Create a new memory object */
    fd = shm_open( "/bolts", O_RDWR | O_CREAT, 0777 );
    if( fd == -1 ) {
        fprintf( stderr, "Open failed:%s\n",
            strerror( errno ) );
        return EXIT_FAILURE;
    }
    
    /* Set the memory object's size */
    if( ftruncate( fd, sizeof( *addr ) ) == -1 ) {
        fprintf( stderr, "ftruncate: %s\n",
            strerror( errno ) );
        return EXIT_FAILURE;
    }

    /* Map the memory object */
    addr = mmap( 0, sizeof( *addr ),
            PROT_READ | PROT_WRITE,
            MAP_SHARED, fd, 0 );
    if( addr == MAP_FAILED ) {
        fprintf( stderr, "mmap failed: %s\n",
            strerror( errno ) );
        return EXIT_FAILURE;
    }

    printf( "Map addr is 0x%08x\n", addr );

    /* Write to shared memory */
    *addr = 1;

    /*
     * The memory object remains in
     * the system after the close
     */
    close( fd );

    /*
     * To remove a memory object
     * you must unlink it like a file.
     *
     * This may be done by another process.
     */
    shm_unlink( "/bolts" );

    return EXIT_SUCCESS;
}
```
