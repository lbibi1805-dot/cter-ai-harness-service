---
title: "Importing Code Coverage results"
category: "QNX-TESTING"
source: "https://www.qnx.com/developers/docs/7.0.0/"
tags: [qnx, testing, qnx-testing, code-coverage]
---

|                                                                                                                                                                       |     |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- |
| [](https://www.qnx.com/developers/docs/7.0.0/index.html?q=/developers/docs/7.0.0/com.qnx.doc.ide.userguide/topic/importing_coverage_results.html "Link to this page") |     |
|                                                                                                                                                                       |     |

# Importing Code Coverage results

If you have coverage data generated outside of the IDE, you can import that data and view the results.

When you run any binary built with code coverage information, the process outputs coverage data (`.gcda`) files when the program exits normally. For a command line setting, the files are written to a target directory area based on the [`GCOV_PREFIX` environment variable](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.ide.userguide/topic/measuring_code_coverage.html#cmd_ln "After building an application with code coverage instrumentation, you can copy its binary to a QNX target and run it from the command line. The generated coverage data contain the same measurements reported through the IDE."). If you run the binary from the command line without setting `GCOV_PREFIX` or from the IDE, which doesn't use this variable, the data files are written to a directory area within the target directory in which the binary runs (e.g., /tmp/workspace_dir/project_name/build/x86-coverage/src/).

If you prefer, you can copy the coverage data files from the target to the host with the [Target Navigator](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.ide.userguide/topic/target_navigator.html "The Target Navigator lists the targets and, for the connected ones, the processes running on them. Through this view's controls, you can configure kernel event tracing and adaptive partitioning for targets and send signals to processes, attach the debugger to them, and adjust their scheduling properties."), but the import feature does allow you to read from a file on the target.

To import Code Coverage results:

1. In the Analysis Sessions view, click the Import button (![Icon: Import button](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.ide.userguide/images/icons/import.png)) in the toolbar at the top.
    
    You can also right-click any session and select Import Session from the context menu.
    
2. In the Import window, select GCC Coverage Data and click Next.
    
    The GCC Coverage Import dialog is opened and it displays fields for defining a new Code Coverage session.
    
3. Enter the session name, the project for which the coverage data was generated, and the platform of the binary that produced the data files.
    
    For the project entry, you can click Browse and select any workspace project from the selector. The platform dropdown is then populated with the platforms supported by that project.
    
    When you've defined the session settings, click Next to proceed to the Data file location dialog.
    
4. **Optional:** Select the protocol type for the coverage data.
    
    Different GCC versions use different protocols (formats) for outputting coverage data. See the QNX SDP release notes for the GCC version number supported by a particular SDP release.
    
5. Specify the coverage data location.
    
    If you leave the Look up in the project box checked, the IDE looks in the project directory (and its subdirectories) to find the coverage data. You can uncheck this box to manually select the data location. In this case, you can type a directory into the text field or use any of the Remote Target, Workspace, or File System buttons to select the directory.
    
    If you want to include coverage data from referenced projects, click Next to proceed to the last wizard dialog. Otherwise, click Finish.
    
6. **Optional:** In the list at the top, select the referenced projects from which you want to include data.
    
    You can also enter comments for the new session, in the text area below the projects list. When you've specified the referenced projects, click Finish.
    

A new Code Coverage session is created and displayed in the Analysis Sessions view. The new session shows the coverage data read from the files found in the previously specified location. For details on interpreting the results, see “[How Code Coverage results are presented](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.ide.userguide/topic/code_coverage_tool.html#code_coverage_tool__read_results)”.
