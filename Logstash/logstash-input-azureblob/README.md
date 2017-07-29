# Logstash input plugin for Azure Storage Blobs

## Summary
This plugin reads and parses data from Azure Storage Blobs.

## Installation
You can install this plugin using the Logstash "plugin" or "logstash-plugin" (for newer versions of Logstash) command:
```sh
logstash-plugin install logstash-input-azureblob
```
For more information, see Logstash reference [Working with plugins](https://www.elastic.co/guide/en/logstash/current/working-with-plugins.html).

## Configuration
### Required Parameters
__*storage_account_name*__

The storage account name.

__*storage_access_key*__

The access key to the storage account.

__*container*__

The blob container name.

### Optional Parameters
__*endpoint*__

Specifies the endpoint of Azure Service Management. The default value is `core.windows.net`. 

__*registry_path*__

Specifies the file path for the registry file to record offsets and coordinate between multiple clients. The default value is `data/registry`.

Overwrite this value when there happen to be a file at the path of `data/registry` in the azure blob container.

__*interval*__

Set how many seconds to idle before checking for new logs. The default, `30`, means idle for `30` seconds.

__*registry_create_policy*__

Specifies the way to initially set offset for existing blob files.

This option only applies for registry creation. 

Valid values include:

  - resume
  - start_over

The default, `resume`, means when the registry is initially created, it assumes all blob has been consumed and it will start to pick up any new content in the blobs.

When set to `start_over`, it assumes none of the blob is consumed and it will read all blob files from begining.

Offsets will be picked up from registry file whenever it exists.

### Examples
```
input
{
    azureblob
    {
        storage_account_name => "mystorageaccount"
        storage_access_key => "VGhpcyBpcyBhIGZha2Uga2V5Lg=="
        container => "mycontainer"
    }
}
```

## More information
The source code of this plugin is hosted in GitHub repo [Microsoft Azure Diagnostics with ELK](https://github.com/Azure/azure-diagnostics-tools). We welcome you to provide feedback and/or contribute to the project.