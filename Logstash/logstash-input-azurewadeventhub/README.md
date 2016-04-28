# Logstash input plugin for Azure diagnostics data from Event Hubs 

## Summary
This plugin reads Azure diagnostics data from specified Azure Event Hubs and parses the data for output.

## Installation
You can install this plugin using the Logstash "plugin" or "logstash-plugin" (for newer versions of Logstash) command:
```sh
logstash-plugin install logstash-input-azurewadeventhub
```
For more information, see Logstash reference [Working with plugins](https://www.elastic.co/guide/en/logstash/current/working-with-plugins.html).

## Configuration
### Required Parameters
*key*

The shared access key to the target event hub.

*username*

The name of the shared access policy.

*namespace*

Event Hub namespace.

*eventhub*

Event Hub name.

*partitions*

Partition count of the target event hub.

### Optional Parameters
*domain*

Domain of the target Event Hub. Default value is "servicebus.windows.net".

*port*

Port of the target Event Hub. Default value is 5671.

*receive_credits*

The credit number to limit the number of messages to receive in a processing cycle. Default value is 1000.

*consumer_group*

Name of the consumer group. Default value is "$default".

*time_since_epoch_millis*

Specifies the point of time after which the messages are received. Default value is the time when this plugin is initialized:
```ruby
Time.now.utc.to_i * 1000
```
*thread_wait_sec*

Specifies the time (in seconds) to wait before another try if no message was received.

### Examples
```json
input
{
    azurewadeventhub
    {
        key => "VGhpcyBpcyBhIGZha2Uga2V5Lg=="
        username => "receivepolicy"
        namespace => "mysbns"
        eventhub => "myeventhub"
        partitions => 4
    }
}
```

## More information
The source code of this plugin is hosted in GitHub repo [Microsoft Azure Diagnostics with ELK](https://github.com/Azure/azure-diagnostics-tools). We welcome you to provide feedback and/or contribute to the project.

Please also see [Analyze Diagnostics Data with ELK template](https://github.com/Azure/azure-quickstart-templates/tree/master/diagnostics-with-elk) for quick deployment of ELK to Azure.   