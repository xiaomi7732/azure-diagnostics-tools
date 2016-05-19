var ladcfgConfigPrototype = {
    
    // JSON public config prototype
    jsonPublic : `
{
    "ladCfg": {
        "diagnosticMonitorConfiguration": {
            "eventVolume":  "Small",
            "sinks": "",
            "metrics": {
                "resourceId": "/SUBSCRIPTIONS/<subscriptionGuid>/RESOURCEGROUPS/<resourceGroupName>/PROVIDERS/Microsoft.Compute/virtualMachines/<vmName>",
                "metricAggregation": [
                    {
                        "scheduledTransferPeriod": "PT1H"
                    }
                ]
            },
            "performanceCounters": {
                "performanceCounterConfiguration": [
                    {
                        "namespace": "root/scx",
                        "class": "Processor",
                        "counterSpecifier": "PercentProcessorTime",
                        "table": "LinuxProcessor",
                        "condition": ""
                    }
                ]
            },
            "fileLogs": {
                "fileLogConfiguration": [
                    {
                        "file": "/var/log/mylogfile1",
                        "table": "FileLogs"
                    }
                ]
            },
            "syslogCfg": "{base64 encoded syslog config}"
        },
        "sinksConfig": {
            "sinks": [
                {
                    "name": "whatever",
                    "applicationInsights": "my-ai-key"
                }
            ]
        }
    },
    "StorageAccount": "mystorageaccount",
    "xmlCfg": "{base64 encoded xml config}",
    "perfCfg":[
        {
            "query":"SELECT PercentAvailableMemory, AvailableMemory, UsedMemory ,PercentUsedSwap FROM SCX_MemoryStatisticalInformation",
            "table":"LinuxOldMemory"
        }
    ],
    "fileCfg":[
        {
            "file":"/var/log/mysql.err",
            "table":"mysqlerr"
        }
    ],
    "eventVolume": "Small",
    "sampleRateInSeconds": 60
}
`.replace(/\\/g, "\\\\\\\\"), // Since this string will be fed through the JSON parser, all backslashes need to be escaped two more times

    // JSON private config prototype
    jsonPrivate : `
{
    "storageAccountName": "myStorageAccount",
    "storageAccountKey": "{base64 encoded key}"
}
`.replace(/\\/g, "\\\\\\\\"), // Since this string will be fed through the JSON parser, all backslashes need to be escaped two more times

    // XML public config prototype
    xmlPublic : null,
    
    // XML private config prototype
    xmlPrivate : null
}
