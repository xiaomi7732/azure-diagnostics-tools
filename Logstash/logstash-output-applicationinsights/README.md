# Logstash output plugin for Application Insights 

## Summary


## Installation
You can install this plugin using the Logstash "plugin" or "logstash-plugin" (for newer versions of Logstash) command:
```sh
logstash-plugin install logstash-output-applicationinsights
```
For more information, see Logstash reference [Working with plugins](https://www.elastic.co/guide/en/logstash/current/working-with-plugins.html).

## Configuration
### Required Parameters
__*ikey*__

The Application Insights Instrumentation key.

### Optional Parameters
__*ai_message_field*__

Specifies the name of the field of the event to be used as the Message field of the AI trace. If not specified, Message in AI will be "Null".

__*ai_properties_field*__

Specifies the name of the field of the event to be used as the Properties field of the AI trace. If not specified, all fields in event will be used.

__*dev_mode*__

If this is set to True, the plugin sends telemetry to Application Insights immediately; otherwise the plugin respects production sending policies defined by other properties.

### Examples
```
output
{
    applicationinsights
    {
        ikey => "00000000-0000-0000-0000-000000000000"
        dev_mode => true
        ai_message_field => "EventMessage"
        ai_properties_field => "EventProperties"
    }
}
```

## More information
The source code of this plugin is hosted in GitHub repo [Microsoft Azure Diagnostics with ELK](https://github.com/Azure/azure-diagnostics-tools). We welcome you to provide feedback and/or contribute to the project.

Please also see [Analyze Diagnostics Data with ELK template](https://github.com/Azure/azure-quickstart-templates/tree/master/diagnostics-with-elk) for quick deployment of ELK to Azure.   
