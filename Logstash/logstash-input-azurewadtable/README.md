# Logstash input plugin for Azure diagnostics data from Storage Tables 

## Summary
This plugin reads Azure diagnostics data from specified Azure Storage Table and parses the data for output.

## Installation
You can install this plugin using the Logstash "plugin" or "logstash-plugin" (for newer versions of Logstash) command:
```sh
logstash-plugin install logstash-input-azurewadtable
```
For more information, see Logstash reference [Working with plugins](https://www.elastic.co/guide/en/logstash/current/working-with-plugins.html).

## Configuration
### Required Parameters
__*account_name*__

The Azure Storage account name.

__*access_key*__

The access key to the storage account.

__*table_name*__

The storage table to pull data from.

### Optional Parameters
__*entity_count_to_process*__

The plugin queries and processes table entities in a loop, this parameter is to specify the maximum number of entities it should query and process per loop. The default value is 100.

__*collection_start_time_utc*__

Specifies the point of time after which the entities created should be included in the query results. The default value is when the plugin gets initialized:

```ruby
Time.now.utc.iso8601
```
__*etw_pretty_print*__

True to pretty print ETW files, otherwise False. The default value is False.

__*idle_delay_seconds*__

Specifies the seconds to wait between each processing loop. The default value is 15.  

__*endpoint*__

Specifies the endpoint of Azure environment. The default value is "core.windows.net".  

__*past_queries_count*__
Specifies the number of past queries to run so the plugin doesn't miss late arriving data. By default this is 5

### Examples
```
input
{
    azurewadtable
    {
        account_name => "mystorageaccount"
        access_key => "VGhpcyBpcyBhIGZha2Uga2V5Lg=="
        table_name => "WADWindowsEventLogsTable"
    }
}
```

## Partition Key Format
When fetching data from Azure storage, this plugin assumes the data was produced by the Windows Azure Diagnostics (WAD) agent and queries according to its partition key format. The format differs depending on the eventVolume parameter in WAD configuration. Here is a short explanation of the format, not meant to be a full explanation though.

### Small (default)
```
0636543145200000000
```

### Medium or Large
```
0000000000000000001___0636543145200000000
```

For small eventVolume, the partition key is just the timestamp. This timestamp is a count of 100 nanoseconds since Jan 1st, 0001. The logic for computing this in the plugin is [here](https://github.com/Azure/azure-diagnostics-tools/blob/master/Logstash/logstash-input-azurewadtable/lib/logstash/inputs/azurewadtable.rb#L203).

For medium and large eventVolume, three '_' and a partition id is prepended to the timestamp. (Example above: 0000000000000000001). This partition id allows Azure storage to further distribute the data so it can reach better throughput. For medium eventVolume, this number can be between 0 and 9. For large eventVolume, this number can be between 0 and 99.

## More information
The source code of this plugin is hosted in GitHub repo [Microsoft Azure Diagnostics with ELK](https://github.com/Azure/azure-diagnostics-tools). We welcome you to provide feedback and/or contribute to the project.

Please also see [Analyze Diagnostics Data with ELK template](https://github.com/Azure/azure-quickstart-templates/tree/master/diagnostics-with-elk) for quick deployment of ELK to Azure.   
