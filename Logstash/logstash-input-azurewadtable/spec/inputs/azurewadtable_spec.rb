require "logstash/devutils/rspec/spec_helper"
require "logging"
require "logstash/inputs/azurewadtable"
require "azure/storage"

ACCOUNT_KEY = "AZURE_STORAGE_ACCOUNT"
ACCESS_KEY = "AZURE_STORAGE_ACCESS_KEY"

if !ENV.has_key?(ACCOUNT_KEY) || !ENV.has_key?(ACCESS_KEY)
    fail "The environment vars '#{ACCOUNT_KEY}' and '#{ACCESS_KEY}' must be set before running these tests"
end

@@debug_output_logging_to_console = false
@@debug_remove_data_after_test = true
@@entity_count_to_process = 5

describe "LogStash::Inputs::AzureWADTable using Account and Access Key"  do
    
    describe "#run" do
        def CreateTestTable
            @table_name = "IntTest#{Time.now.strftime("%Y%m%d%H%M%S")}"
            
            puts "Creating temp table: #{@table_name}"
            Azure::Storage.client.table_client.create_table @table_name
        
            return @table_name
        end
        
        def CreateSUT(table_name)
            @azurewadtable = LogStash::Inputs::AzureWADTable.new        
            @azurewadtable.instance_variable_set(:@account_name, ENV.fetch(ACCOUNT_KEY))
            @azurewadtable.instance_variable_set(:@access_key, ENV.fetch(ACCESS_KEY))
            @azurewadtable.instance_variable_set(:@table_name, table_name)
            @azurewadtable.instance_variable_set(:@data_latency_minutes, 0)
            @azurewadtable.instance_variable_set(:@entity_count_to_process, @@entity_count_to_process)
            if (@@debug_output_logging_to_console)
                @logger = Logging.logger(STDOUT)
                @logger.level = :debug
                @azurewadtable.instance_variable_set(:@logger, @logger)
            end
            @azurewadtable.register
            return @azurewadtable
        end

        def RemoveTestTable(table_name)
            puts "Removing temp table: #{table_name}"
            begin
                Azure::Storage.client.table_client.delete_table table_name
            rescue
            end
        end

        before(:all) do
            Azure::Storage.configure do |config|
                config.storage_access_key       = ENV.fetch(ACCESS_KEY)
                config.storage_account_name     = ENV.fetch(ACCOUNT_KEY)
                Azure::Storage.client(storage_account_name: config.storage_account_name, storage_access_key: config.storage_access_key)
            end

            @table_name = CreateTestTable()
            @azurewadtable = CreateSUT(@table_name)
            
            @output_queue = Queue.new
            puts "Starting thread for AzureWADTable plugin"
            
            @plugin_thread = Thread.new {
                @azurewadtable.run(@output_queue)
            }
        end

        after(:all) do
            puts "Stopping thread for AzureWADTable plugin"
            @plugin_thread.kill

            if @@debug_remove_data_after_test
                RemoveTestTable(@table_name)
            end
        end

        it "should read a single record from the table" do
            @output_queue.clear()

            puts "Adding a single record to TableStorage"
            @time = Time.now - 60
            @partitionKey = "0#{@azurewadtable.to_ticks(@time)}"
            
            @entity = { "PartitionKey" => @partitionKey, "RowKey" => "rowkey_#{@partitionKey}" }
            Azure::Storage.client.table_client.insert_entity @table_name, @entity

            @event = @output_queue.pop
            expect(@event.get("PartitionKey")).to eq(@partitionKey)
        end

        it "should read all the records from the table, when the entity_count_to_process creates more than one page" do
            @output_queue.clear()
            @total_records = @@entity_count_to_process + 2

            puts "Adding multiple records to TableStorage"
            for i in 1..@total_records do
                @time = Time.now - 60
                @partitionKey = "0#{@azurewadtable.to_ticks(@time)}"
                
                @entity = { "PartitionKey" => @partitionKey, "RowKey" => "rowkey_#{@partitionKey}" }
                Azure::Storage.client.table_client.insert_entity @table_name, @entity
                sleep(1)
            end

            puts "Waiting while AzureWADTable plugin polls table, default polling interval is 15 seconds"
            sleep(15)
            
            expect(@output_queue.length).to eq(@total_records)
        end
    end
end