#r "System.Configuration"

using System;
using System.Configuration;
using Elasticsearch.Net;
using Nest;

public static async Task Run(string myEventHubMessage, TraceWriter log)
{
    await SendEventToElasticSearch(myEventHubMessage, log);
}

private const string Setting_Es_Uri = "es_uri";
private const string Setting_Es_Username = "es_username";
private const string Setting_Es_Password = "es_password";
private const string Setting_Es_Index_Name_Prefix = "es_index_name_prefix";
private const string Error_Es_Uri_Missing = "Setting \"" + Setting_Es_Uri + "\" is missing.";
private const string Error_Es_Username_Missing = "Setting \"" + Setting_Es_Username + "\" is missing.";
private const string Error_Es_Password_Missing = "Setting \"" + Setting_Es_Password + "\" is missing.";
private const string DefaultIndexNamePrefix = "wadeventhub";
private const string EventDocumentTypeName = "event";

private static async Task SendEventToElasticSearch(string myEventHubMessage, TraceWriter log)
{
    string esUri = ConfigurationManager.AppSettings[Setting_Es_Uri];
    string username = ConfigurationManager.AppSettings[Setting_Es_Username];
    string password = ConfigurationManager.AppSettings[Setting_Es_Password];
    string indexNamePrefix = ConfigurationManager.AppSettings[Setting_Es_Index_Name_Prefix];

    if (string.IsNullOrWhiteSpace(esUri))
    {
        ReportError(log, Error_Es_Uri_Missing, throwException: true);
    }

    if (string.IsNullOrWhiteSpace(username))
    {
        ReportError(log, Error_Es_Username_Missing, throwException: true);
    }

    if (string.IsNullOrWhiteSpace(password))
    {
        ReportError(log, Error_Es_Password_Missing, throwException: true);
    }

    if (string.IsNullOrWhiteSpace(indexNamePrefix))
    {
        log.Warning($"Setting \"{Setting_Es_Index_Name_Prefix}\" not specified, using default value \"{DefaultIndexNamePrefix}\".");
        indexNamePrefix = DefaultIndexNamePrefix;
    }

    log.Info($"Sending Event Hub data to ElasticSearch at {esUri} ...");

    ConnectionSettings connectionSettings = new ConnectionSettings(new Uri(esUri)).BasicAuthentication(username, password);
    ElasticClient client = new ElasticClient(connectionSettings);

    string indexName = GetIndexName(indexNamePrefix);
    await EnsureIndexExists(indexName, client, log);

    var data = new PostData<string>(myEventHubMessage);
    var result = await client.LowLevel.IndexAsync<string>(indexName, EventDocumentTypeName, data);

    if (result.Success)
    {
        log.Info("Data successfully sent.");
        log.Verbose(result.Body);
    }
    else
    {
        ReportError(log, $"Failed to send data.{Environment.NewLine}{result.DebugInformation}", throwException: true);
    }
}

private static string GetIndexName(string indexNamePrefix)
{
    DateTimeOffset now = DateTimeOffset.UtcNow;
    string retval = $"{indexNamePrefix}-{now.Year.ToString("0000")}.{now.Month.ToString("00")}.{now.Day.ToString("00")}";
    return retval;
}

private static async Task EnsureIndexExists(string currentIndexName, ElasticClient esClient, TraceWriter log)
{
    IExistsResponse existsResult = await esClient.IndexExistsAsync(currentIndexName);
    if (!existsResult.IsValid)
    {
        ReportError(log, $"Index exists check failed.{Environment.NewLine}{existsResult.DebugInformation}", throwException: true);
    }

    if (existsResult.Exists)
    {
        return;
    }

    // TODO: allow the consumer to fine-tune index settings 
    IndexState indexState = new IndexState();
    indexState.Settings.NumberOfReplicas = 1;
    indexState.Settings.NumberOfShards = 5;
    indexState.Settings.Add("refresh_interval", "15s");

    ICreateIndexResponse createIndexResult = await esClient.CreateIndexAsync(currentIndexName, c => c.InitializeUsing(indexState));

    if (!createIndexResult.IsValid)
    {
        if (createIndexResult.ServerError != null &&
            createIndexResult.ServerError.Error != null &&
            string.Equals(createIndexResult.ServerError.Error.Type, "IndexAlreadyExistsException", StringComparison.OrdinalIgnoreCase))
        {
            // This is fine, someone just beat us to create a new index. 
            return;
        }

        ReportError(log, $"Create index failed.{Environment.NewLine}{createIndexResult.DebugInformation}", throwException: true);
    }
}

private static void ReportError(TraceWriter log, string errorMessage, bool throwException)
{
    log.Error(errorMessage);

    if (throwException)
    {
        throw new ApplicationException(errorMessage);
    }
}