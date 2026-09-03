---
title: "shm_ctl(), shm_ctl_special()"
category: "IPC"
source: "https://www.qnx.com/developers/docs/7.0.0/"
tags: [qnx, ipc, message-passing]
---

# shm_ctl(), shm_ctl_special()
Give special attributes to a shared memory object_

## Synopsis:

```c
#include <sys/mman.h>

int shm_ctl( int fd,
             int flags,
             uint64_t paddr,
             uint64_t size );

int shm_ctl_special( int fd,
                     int flags,
                     uint64_t paddr,
                     uint64_t size,
                     unsigned special );
```

## Arguments:

**fd** —

The file descriptor that's associated with the shared memory object, as returned by [shm_open()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/s/shm_open.html "Open a shared memory object").

**flags** —

A bitwise OR of one or more of the following bits, defined in <sys/mman.h>.

The primary flags are:

- SHMCTL_ANON — allocate anonymous memory.
- SHMCTL_LAZY — delay allocating the memory until it's referenced.

    If you create anonymous shared memory objects (by calling [mmap()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/mmap.html "Map a memory region into a process's address space") with MAP_ANON | MAP_SHARED and a file descriptor of -1), a MAP_LAZY flag implicitly sets the SHMCTL_LAZY flag on the object.

- SHMCTL_PHYS — overlay the shared memory object onto the physical memory at paddr, or allocate physically contiguous memory if used with SHMCTL_ANON.

You can specify the primary flags individually, or in the following combinations:

- SHMCTL_ANON | SHMCTL_LAZY
- SHMCTL_ANON | SHMCTL_PHYS — this combination has the same behavior as for [mmap()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/mmap.html "Map a memory region into a process's address space"): it indicates that you want physically contiguous RAM to be allocated for the object.

The secondary flags include:

- SHMCTL_GLOBAL — a hint that any mapping to the object could be global across all processes.
- SHMCTL_HIGHUSAGE — a hint that the object is used a lot, and so the system should try to do things to speed up access to it.
- SHMCTL_LAZYWRITE — a hint that a mapping of this object could use lazy-writing mechanisms.
- SHMCTL_LOWERPROT — a hint that the system may map this object in such a way that it trades lower memory protection for better performance.
- SHMCTL_PRIV — a hint that a mapping of this object may require privileged access.
- SHMCTL_REPEAT — create a strided physical object; extend an existing object, initialized with the SHMCTL_PHYS flag, with a repeating pattern of physical addresses. For example:

    shm_ctl( fd, SHMCTL_PHYS, baseaddr, vstride );
    shm_ctl( fd, SHMCTL_REPEAT, pstride, count );

Some of the bits have specific meanings for different processors. For more information, see:

- [Bits in the flags argument for x86 processors](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/s/shm_ctl.html#shm_ctl__flags_x86)

**paddr** —

The interpretation of this argument depends on the bits set in flags:

- SHMCTL_PHYS — a physical address to assign to the object.
- SHMCTL_REPEAT — the stride, which is used to increment the physical address given to the original shm_ctl() call

The value of this argument must be a multiple of the page size (sysconf(_SC_PAGESIZE)).

**size** —

The new size of the object, in bytes, regardless of the ANON/PHYS flag. If you specify SHMCTL_PHYS in the flags, then size must be a multiple of the page size.

For SHMCTL_REPEAT, this argument is the length, which is used to increment the offset within the object. The value must be a multiple of the page size.

**special** —

(shm_ctl_special() only) Processor-specific flags; see the following:

- [Bits in the special argument for ARM processors](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/s/shm_ctl.html#shm_ctl__ARM_specific)

Calling shm_ctl_special() with a special argument of 0 is not equivalent to calling shm_ctl(). Specifying 0 for special could clear some special bits that are on by default.

## Library:

libc

Use the -l c option to [qcc](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.utilities/topic/q/qcc.html) to link against this library. This library is usually included automatically.

## Description:

The shm_ctl() function modifies the attributes of the shared memory object identified by the handle, fd. This handle is the value returned by [shm_open()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/s/shm_open.html "Open a shared memory object"). The shm_ctl_special() function is similar to shm_ctl(), but has an additional, processor-specific argument.

Your process might need some abilities enabled (see [procmgr_ability()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/procmgr_ability.html "Control a process's ability to perform certain operations")):

|In order to use:|You need:|
|---|---|
|SHMCTL_GLOBAL|PROCMGR_AID_MEM_GLOBAL|
|SHMCTL_PHYS|PROCMGR_AID_MEM_PHYS|
|shm_ctl_special()|PROCMGR_AID_MEM_SPECIAL|

Typically, you can call shm_ctl() only once on a **new** object created with shm_open(). Reopening an existing object with the O_TRUNC flag doesn't make the object new again.

You can make subsequent calls to shm_ctl() only in order to extend an existing object, and only when using the same primary flags as in the original call. How you can extend an existing object depends on the primary flags:

- You can extend objects created with SHMCTL_PHYS (an explicit physical address) in one of these ways:
    - by seeking beyond the end of the object—typically with [lseek()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/l/lseek.html "Set the current file position at the operating-system level")—and installing another physical address and size with shm_ctl(... SHMCTL_PHYS ...)
    - by calling shm_ctl(... SHMCTL_REPEAT ...) when the fd is at the beginning of the object
- Objects created with SHMCTL_ANON or SHMCTL_LAZY are extended to a new size that's the current offset plus the size provided in the shm_ctl() call. Note that you can't shrink an object; the second call is ignored if the resulting size is smaller than the current one. For the non-lazy case, memory is allocated to fill the difference between the previous and current sizes.

If you first initialized an object with shm_ctl_special(), all subsequent calls that follow the rules above must also be done with shm_ctl_special(), using the same special attributes.

**Bits in the flags argument for x86 processors**

For x86 processors:

- SHMCTL_LAZYWRITE causes Write Combining to be used. Write Combining is normally used for write-only purposes, such as a video buffer, as a high-performance alternative to PROT_NOCACHE:
    - Writes are significantly faster than those to PROT_NOCACHE memory.
    - Reads have the same performance as those from PROT_NOCACHE memory, so they could be slow.
    - If memory has been previously mapped as a cached memory type, the caches must be flushed, or undefined behavior may result.
    - Write Combining works on SMP systems.

**Bits in the special argument for ARM processors**

For ARM platforms, the special argument specifies the memory attributes that will be used when the object is mapped. You can specify the memory attributes via one of the following:

ARM_SHMCTL_SO

Map the object with the Strongly Ordered memory attribute. This provides uncached access and provides implicit memory ordering equivalent to a barrier before and after the memory access.

All loads and stores must be aligned for the access size, otherwise a memory fault is triggered resulting in delivery of a SIGBUS signal.

ARM_SHMCTL_DEV

Map the object with the Device memory attribute. This provides uncached access and is subject to the ordering rules defined by the ARM Architecture Reference Manual.

All loads and stores must be aligned for the access size, otherwise a memory fault is triggered resulting in delivery of a SIGBUS signal.

Reads are performed using a single memory access with the size as specified by the load instruction.

Stores are performed using a single memory access with the size as specified by the load instruction.

An explicit memory barrier may be required after store operations to ensure visibility of the store to the memory system.

For an example on using this flag, see “[Sharing device memory](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/s/shm_ctl.html#shm_ctl__arm_shmctl_dev)” below.

ARM_SHMCTL_NC

Map the object with the Normal Uncached memory attribute. This provides uncached access and is subject to the ordering rules defined by the ARM Architecture Reference Manual.

Loads and stores may be performed to unaligned addresses, except for those instructions that always require correct alignment.

Stores can be merged into a write buffer before being written to the memory system.

An explicit memory barrier may be required after store operations to ensure visibility of the store to the memory system.

ARM_SHMCTL_WT

Map the object with the Normal Write-Through attribute. This provides cacheable access, subject to the ordering rules for Normal memory types.

Loads and stores may be performed to unaligned addresses, except for those instructions that always require correct alignment.

Loads allocate a cache line and return data from the cache.

Stores don't cause allocation of a cache line. If a store hits in the cache, the cache is modified and the data is written to memory via a write buffer. If a store misses in the cache, the data is written to memory via a write buffer. Multiple stores may be merged in the write buffer before being written to the memory system.

ARM_SHMCTL_WB

Map the object with the Normal Write-Back attribute. This provides cacheable access, subject to the ordering rules for Normal memory types.

Loads and stores may be performed to unaligned addresses, except for those instructions that always require correct alignment.

Loads allocate a cache line and return data from the cache.

Stores don't cause allocation of a cache line. If a store hits in the cache, the cache is modified and the line is marked for write back to the memory system at a later time. If a store misses in the cache, the data is written to memory via a write buffer. Multiple stores may be merged in the write buffer before being written to the memory system.

ARM_SHMCTL_WBWA

Map the object with the Normal Write-Back, Write-Allocate attribute. This provides cacheable access, subject to the ordering rules for Normal memory types.

Loads and stores may be performed to unaligned addresses, except for those instructions that always require correct alignment.

Loads allocate a cache line and return data from the cache.

Stores allocate a cache line and modify the cache, marking the line for write back to the memory system at a later time.

You can specify the shareability of the mapping with the following:

ARM_SHMCTL_SH

Map the object with the Shareable memory attribute. The memory may be accessed by multiple observers (other processors or bus masters). This is used to indicate that the memory has coherency requirements. You'll almost always want to specify this flag.

For ARM_SHMCTL_NC, accesses are coherent with respect to loads and stores, and the additional coherency applies to load/store exclusive operations.

For ARM_SHMCTL_WT, ARM_SHMCTL_WB, and ARM_SHMCTL_WBWA, this indicates that hardware cache coherency is required.

The level at which this coherency applies is system dependent, and it may still require explicit cache maintenance to enforce coherency for memory accesses by other bus masters (e.g., DMA operations).

The ARM MMU is now configured to use the TEX remap facility, which limits the range of memory attributes that can be used. Versions of QNX Neutrino before 7.0 didn't use TEX remap, and this allowed shm_ctl_special() to specify any attribute encoded via the TEX[2:0], C, and B bits. Any encoding using nonzero TEX[2:1] bits is no longer possible.

You can find full details of the ARM memory attributes and ordering requirements in section A3.5, “Memory types and attributes and the memory order model,” in the ARM Architecture Reference Manual (ARM DDI 0406).

## Returns:

0

Success.

-1

An error occurred ([errno](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/e/errno.html "Thread-local error variable") is set).

## Errors:

### `EAGAIN`

(shm_ctl_special() only) The special value doesn't match the current special value.

### `EBADF`

The shared memory object is already “special.”

### `EBUSY`

You tried to extend a contiguous object.

### `EINVAL`

Invalid arguments, including the following:

- An invalid combination of flags was specified.
- You specified SHMCTL_PHYS in the flags, but the value of paddr or size isn't a multiple of the page size.
- You tried to allocate memory beyond the current end of the object.
- You specified SHMCTL_REPEAT in the flags, and the stride isn't a multiple of the page size.

### `ENOMEM`

There wasn't enough memory.

### `EPERM`

The calling process doesn't have the required permission; see [procmgr_ability()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/procmgr_ability.html "Control a process's ability to perform certain operations").

## Examples:

```c
The following examples go together. Run sharephyscreator, followed by sharephysuser.

The sharephyscreator process maps in an area of physical memory and then overlays it with a shared memory object. The sharephysuser process opens that shared memory object in order to access the physical memory.

/*
 *  sharephyscreator.c
 *
 *  This maps in an area of physical memory and then
 *  overlays it with a shared memory object.  This way, another process
 *  can open that shared memory object in order to access the physical
 *  memory.  The other process in this case is sharephysuser.
 *
 *  Note that the size and address that you pass to shm_ctl() must be
 *  multiples of the page size (sysconf(_SC_PAGESIZE)).
 *
 *  For VGA color text mode video memory:
 *    sharephyscreator /wally b8000
 *  Note that for VGA color text mode video memory, each character
 *  is followed by an attribute byte.  Here we just use a space.
*/

#include <errno.h>
#include <fcntl.h>
#include <inttypes.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <sys/mman.h>
#include <sys/neutrino.h>
#include <sys/stat.h>

char        *progname = "sharephyscreator";

main( int argc, char *argv[] )
{
    char        *text = "H e l l o   w o r l d ! ";
    int         fd, memsize;
    char        *ptr, *name;
    uint64_t    physaddr;
    
    if ( argc != 3 ) {
        printf( "Use: sharephyscreator shared_memory_object_name \
physical_address_in_hex\n" );
        printf( "Example: sharephyscreator wally b8000\n" );
        exit( EXIT_FAILURE );
    }
    name = argv[1];
    physaddr = strtoul(argv[2], NULL, 16);
    memsize = sysconf( _SC_PAGESIZE ); /* this should be enough
                                          for our string */
   
    /* map in the physical memory */
    
    ptr = mmap( 0, memsize, PROT_READ | PROT_WRITE, MAP_PHYS | MAP_SHARED,
                NOFD, physaddr );
    if ( ptr == MAP_FAILED ) {
        printf( "%s: mmap for physical address %llx failed: %s\n",
            progname, physaddr, strerror(errno) );
        exit( EXIT_FAILURE );
    }

    /* open the shared memory object, create it if it doesn't exist */
    
    fd = shm_open( name, O_RDWR | O_CREAT, 0 );
    if ( fd == -1 ) {
        printf( "%s: error creating the shared memory object '%s': %s\n",
                progname, name, strerror(errno) );
        exit( EXIT_FAILURE );
    }
    
    /* overlay the shared memory object onto the physical memory */
    
    if ( shm_ctl( fd, SHMCTL_PHYS, physaddr, memsize ) == -1 ) {
        printf( "%s: shm_ctl failed: %s\n", progname, strerror(errno) );
        close( fd );
        munmap( ptr, memsize );
        shm_unlink( name );
        exit( EXIT_FAILURE );
    }
    strcpy( ptr, text ); /* write to the shared memory */
    
    printf( "\n%s: Physical memory mapped in, shared memory overlaid onto it.\n"
            "%s: Wrote '%s' to physical memory.\n"
            "%s: Sleeping for 20 seconds.  While this program is sleeping\n"
            "%s: run 'sharephysuser %s %d'.\n",
            progname, progname, ptr, progname, progname, name,
            strlen(text)+1 );
    sleep( 20 );
    
    printf( "%s: Woke up.  Cleaning up and exiting ...\n", progname );
    
    close( fd );
    munmap( ptr, memsize );
    shm_unlink( name );
}

The following is meant to be run with sharephyscreator.

/*
 *  sharephysuser.c
 *
 *  This one is meant to be run in tandem with sharephyscreator.
 *
 *  Run it as: sharephysuser shared_memory_object_name length
 *  Example: sharephysuser wally 49
 *
*/

#include <errno.h>
#include <fcntl.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <sys/mman.h>
#include <sys/neutrino.h>
#include <sys/stat.h>

char        *progname = "sharephysuser";

main( int argc, char *argv[] )
{
    int     fd, len, i;
    char    *ptr, *name;
    
    if ( argc != 3 ) {
        fprintf( stderr, "Use: sharephysuser shared_memory_object_name \
length\n" );
        fprintf( stderr, "Example: sharephysuser wally 49\n" );
        exit( EXIT_FAILURE );
    }
    name = argv[1];
    len = atoi( argv[2] );
    
    /* open the shared memory object */
    
    fd = shm_open( name, O_RDWR, 0 );
    if ( fd == -1 ) {
        fprintf( stderr, "%s: error opening the shared memory object '%s': %s\n",
                progname, name, strerror(errno) );
        exit( EXIT_FAILURE );
    }

    /* get a pointer to a piece of the shared memory, note that we
       only map in the amount we need to */
    
    ptr = mmap( 0, len, PROT_READ | PROT_WRITE, MAP_SHARED, fd, 0 );
    if ( ptr == MAP_FAILED ) {
        fprintf( stderr, "%s: mmap failed: %s\n", progname, strerror(errno) );
        exit( EXIT_FAILURE );
    }

    printf( "%s: reading the text: ", progname );
    for ( i = 0; i < len; i++ )
        printf( "%c", ptr[i] );
    printf( "\n" );

    close( fd );
    munmap( ptr, len );
}
```

## Sharing device memory

This example shows how to create a region of device memory using a shared object, map this memory into the current process's address space, and then destroy the memory when the program is finished using it.

/*
 *  create_device_shm.c
*/
#include <string.h>
#include <unistd.h>
#include <sys/mman.h>
#include <aarch64/mmu.h>
#include <stdint.h>
#include <assert.h>
#include <fcntl.h>

#define S1_SHM_NAME	"shm_s1"

#define TOTAL_PAGE_SIZE    (4096)

static char *src;
static int src_fd;

/** Remove the shared memory object and destroy the device memory */
void destroy_device_shm(int shm_fd, char *name)
{
    close(shm_fd);
    shm_unlink(name);
}

/**
 * Create a shared memory object and configure it to simulate device memory.
 * Return the file descriptor of the new object if successful, -1 otherwise.
 */
int create_device_shm(char *name, uint64_t size)
{
    int fd;
    int rc;

    fd = shm_open(name, O_RDWR|O_CREAT|O_TRUNC, 0666);
    if (fd < 0) {
        return -1;
    }
    rc = shm_ctl_special(fd, SHMCTL_ANON | SHMCTL_PHYS, 0, size, **ARM_SHMCTL_DEV**);
    if (rc != 0) {
        destroy_device_shm(fd, name);
        return -1;
    }

    return fd;
}

void cleanup()
{
    munmap(src, TOTAL_PAGE_SIZE);
    destroy_device_shm(src_fd, S1_SHM_NAME);
}

int main(void)
{
    // Create device memory region
    src_fd = create_device_shm(S1_SHM_NAME, TOTAL_PAGE_SIZE);
    assert(src_fd >= 0);

    // Map device memory into current address space
    src = mmap(NULL, TOTAL_PAGE_SIZE, PROT_READ | PROT_WRITE, MAP_SHARED, src_fd, 0);
    assert(src != (void *)MAP_FAILED);

    // Your code goes here

    // Destroy device memory region
    cleanup();
    return 0;
}

## Classification:

[QNX Neutrino](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/summary.html#summary__CLASSIFICATION)

> [!info] Safety — Classification
>
> | Safety | Value |
> |---|---|
> |Cancellation point|Yes|
> |Interrupt handler|No|
> |Signal handler|Yes|
> |Thread|Yes|

### Related reference  

[mmap(), mmap64()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/mmap.html "Map a memory region into a process's address space")

[munmap()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/munmap.html "Unmap previously mapped addresses")

[mprotect()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/m/mprotect.html "Change memory protection")

[procmgr_ability()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/p/procmgr_ability.html "Control a process's ability to perform certain operations")

[shm_open()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/s/shm_open.html "Open a shared memory object")

[shm_unlink()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/s/shm_unlink.html "Remove a shared memory object")

[ThreadCtl(), ThreadCtl_r(), ThreadCtlExt(), ThreadCtlExt_r()](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.neutrino.lib_ref/topic/t/threadctl.html "Control a thread")
