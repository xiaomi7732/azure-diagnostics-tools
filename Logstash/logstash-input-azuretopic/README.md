# Logstash input plugin for Azure Service Bus Topics

## Summary
This plugin reads messages from Azure Service Bus Topics.

## Installation
You can install this plugin using the Logstash "plugin" or "logstash-plugin" (for newer versions of Logstash) command:
```sh
logstash-plugin install logstash-input-azuretopic
```
For more information, see Logstash reference [Working with plugins](https://www.elastic.co/guide/en/logstash/current/working-with-plugins.html).

## Configuration
### Required Parameters
__*namespace*__

The Service Bus namespace.

__*access_key_name*__

The SAS policy name to the Service Bus resource.

__*access_key*__

The SAS policy key to the Service Bus resource.

__*subscription*__

The name of the Topic Subscription.

__*topic*__

The name of the Topic.

### Optional Parameters
__*deliverycount*__

Specifies the number of times to try (and retry) to process a message before the message shall be deleted. The default value is 10.

### Examples
```
input
{
    azuretopic
    {
        namespace => "mysbns"
        access_key_name => "mySASkeyname"
        access_key => "VGhpcyBpcyBhIGZha2Uga2V5Lg=="
        subscription => "mytopicsubscription"
        topic => "mytopic"
    }
}
```

## More information
The source code of this plugin is hosted in GitHub repo [Microsoft Azure Diagnostics with ELK](https://github.com/Azure/azure-diagnostics-tools). We welcome you to provide feedback and/or contribute to the project.