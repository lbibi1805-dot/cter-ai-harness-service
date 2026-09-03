---
title: "Exporting Code Coverage results"
category: "QNX-TESTING"
source: "https://www.qnx.com/developers/docs/7.0.0/"
tags: [qnx, testing, qnx-testing, code-coverage]
---

# Exporting Code Coverage results

Sometimes, it's useful to view coverage data outside of the IDE. The Code Coverage export feature lets you generate a report that contains the data of a coverage session and that can be viewed in a browser.

In this release, there is no longer an action for saving session data to an XML file. Instead, you can export the results from a session into HTML files.

To export Code Coverage results:

1. In the Analysis Sessions view, right-click the session for which you want to save the results.
    
    The session can still be in progress—in this case, the IDE just outputs the results gathered so far.
    
2. Select Export Session from the context menu.
3. In the Save Coverage Report window, specify the path for saving the report as well as the name of the root file.
    
    For convenience, the IDE fills in a default path for saving the report. This path is a subdirectory within the project directory and is named project_name___GCC_Code_Coverage_. The root file (by default, index.html) contains the report summary.
    
    You can set other report generation properties, as explained in “[How to set report properties](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.ide.userguide/topic/code_coverage_tool.html#code_coverage_tool__configure_reports)”.
    

The IDE exports the Code Coverage results into a new report and opens the root file in the default web browser. The report lets you see coverage measurements from the entire program to each source file and function, as explained in “[How to read reports](https://www.qnx.com/developers/docs/7.0.0/com.qnx.doc.ide.userguide/topic/code_coverage_tool.html#code_coverage_tool__read_reports)”.
