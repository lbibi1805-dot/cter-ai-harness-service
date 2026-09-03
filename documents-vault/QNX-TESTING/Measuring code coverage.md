---
title: "Measuring code coverage"
category: "QNX-TESTING"
source: "https://www.qnx.com/developers/docs/7.0.0/"
tags: [qnx, testing, qnx-testing]
---

# Measuring code coverage

You can build and configure projects in the IDE to collect and display code coverage measurements as the program runs.

You can also run a binary built with code coverage instrumentation [from the command line](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.ide.userguide/topic/measuring_code_coverage.html#cmd_ln "After building an application with code coverage instrumentation, you can copy its binary to a QNX target and run it from the command line. The generated coverage data contain the same measurements reported through the IDE.").

Code coverage can be measured for any executable binary, whether it's a test program or an application. For applications, you can monitor which areas of code are frequently executed and hence, are the best ones to optimize. However, the main use of the Code Coverage tool is to measure the quality of test programs—if any code isn't exercised during testing, it could contain hidden bugs. You can use the results to determine which areas aren't being covered and then write new test cases to cover them.

> [!warning] Coverage Side-Effect
> The Code Coverage tool can make a program behave unpredictably and incorrectly. When the IDE requests coverage data by sending signals to `qconn`, signals are also delivered to blocking function calls, which might change program behavior. For instance, a `sleep()` call might return too soon if the IDE requests coverage data during the timeout period.

To measure code coverage from the IDE:

1. Define the necessary build settings.
    
    You must add certain flags to the compiling and linking commands. The way to do this depends on your makefile type, as explained in “[Enabling Code Coverage instrumentation](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.ide.userguide/topic/buildconfig_add_debug_instcode.html#add_debug_instcode__code_coverage)”.
    
2. In the launch bar, expand the Launch Configuration dropdown and select the project for which you want to measure code coverage.
3. In the Launch Mode dropdown, select Coverage.
4. In the Launch Target dropdown, select the target for running the program.
5. **Optional:** To customize how coverage data are collected, click the Edit button (![Icon: Edit button](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.ide.userguide/images/icons/edit.png)) on the right of the Launch Configuration dropdown, then click the Coverage tab (which is the righmost tab).
    
    You can adjust how often the IDE signals `qconn` to request coverage data or set a nondefault target location for writing the `.gcda` data files. Details about all tool settings are given in “[How to configure Code Coverage](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.ide.userguide/topic/code_coverage_tool.html#code_coverage_tool__configure)”.
    
    When you're finished configuring the tool, click OK to save the changes and close the window.
    
6. In the launch bar, click the Coverage button (![Icon: Coverage button](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.ide.userguide/images/icon_coverage.png)).
    

The IDE switches to the QNX Analysis perspective. If necessary, it first builds the binary (with code coverage instrumentation). Then, the IDE uploads the binary and starts running it on the target. When this happens, a new Code Coverage session is created and displayed in the Analysis Sessions view. For details on interpreting the results, see “[How Code Coverage results are presented](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.ide.userguide/topic/code_coverage_tool.html#code_coverage_tool__read_results)”.

You can run multiple sessions concurrently—the Analysis Sessions view lets you interact with any number of active sessions.

## Generating code coverage data from the command line

After building an application with code coverage instrumentation, you can copy its binary to a QNX target and run it from the command line. The generated coverage data contain the same measurements reported through the IDE.

To measure code coverage from the command line:

1. Define the necessary build settings.
    
    You must add certain flags to the compiling and linking commands. The way to do this depends on your makefile type, as explained in “[Enabling Code Coverage instrumentation](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.ide.userguide/topic/buildconfig_add_debug_instcode.html#add_debug_instcode__code_coverage)”.
    
2. Build the application and verify that the correct binary files are generated.
    
    In addition to the coverage variant of the executable binary (which is noticeably larger than the debug variant), you should find notes (`.gcno`) files for all object files. Notes files are needed for later viewing the coverage results in the IDE.
    
3. On the target, set the `GCOV_PREFIX` environment variable based on where you want to store the coverage data (`.gcda`) files.
    
    The files are actually written to a subdirectory that matches the host location where the binary was built. This subdirectory is contained in the path specified by `GCOV_PREFIX`. For instance, if the binary was built in /home/workspace_dir/project_name/x86/o-g on the host and `GCOV_PREFIX` is set to /usr/coverage, then the data files are written to /usr/coverage/home/workspace_dir/project_name/x86/o-g/ on the target.
    
    If the variable isn't defined, the program tries to write the files to a similar but absolute directory path (e.g., `/home/workspace_dir/project_name/x86/o-g/`). But if the root path is non-writable (as by default), then the directory can't be created and hence, a profiling error message is displayed:

    ```
    profiling:/home:Cannot create directory,
    profiling:/home/workspace_dir/project_name/x86/o-g/some_module.gcda
    ```
    
4. Run the application.
    
    No specific command-line options are needed to enable code coverage because the instrumentation code outputs coverage results as the program runs.
    

When the application exits normally, you should see a data file for each source file, at the location determined by `GCOV_PREFIX`. Note that if a serious error occurs and the application can't exit cleanly, no data files are generated.

- **[Combining results from multiple sessions](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.ide.userguide/topic/combining_coverage_results.html)**  
    You can combine the results from multiple Code Coverage sessions to view the cumulative coverage across distinct runs of a test program.
