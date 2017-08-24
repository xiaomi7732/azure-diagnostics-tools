# encoding: utf-8
require "logstash/inputs/base"
require "logstash/namespace"

# Azure Storage SDK for Ruby
require "azure/storage"
require 'json' # for registry content
require "securerandom" # for generating uuid.

# Registry item to coordinate between mulitple clients
class LogStash::Inputs::RegistryItem
  attr_accessor :file_path, :etag, :offset, :reader, :gen
  # Allow json serialization.
  def as_json(options={})
    {
      file_path: @file_path,
      etag: @etag,
      reader: @reader,
      offset: @offset,
      gen: @gen
    }
  end # as_json

  def to_json(*options)
    as_json(*options).to_json(*options)
  end # to_json

  def initialize(file_path, etag, reader, offset = 0, gen = 0)
    @file_path = file_path
    @etag = etag
    @reader = reader
    @offset = offset
    @gen = gen
  end # initialize
end # class RegistryItem


# Logstash input plugin for Azure Blobs
#
# This logstash plugin gathers data from Microsoft Azure Blobs
class LogStash::Inputs::LogstashInputAzureblob < LogStash::Inputs::Base
  config_name "azureblob"

  # If undefined, Logstash will complain, even if codec is unused.
  default :codec, "json_lines"

  # Set the account name for the azure storage account.
  config :storage_account_name, :validate => :string
  
  # Set the key to access the storage account.
  config :storage_access_key, :validate => :string
  
  # Set the container of the blobs.
  config :container, :validate => :string
  
  # Set the endpoint for the blobs.
  #
  # The default, `core.windows.net` targets the public azure.
  config :endpoint, :validate => :string, :default => 'core.windows.net'

  # Set the value of using backup mode.
  config :backupmode, :validate => :boolean, :default => false, :deprecated => true, :obsolete => 'This option is obsoleted and the settings will be ignored.'
  
  # Set the value for the registry file.
  #
  # The default, `data/registry`, is used to coordinate readings for various instances of the clients.
  config :registry_path, :validate => :string, :default => 'data/registry'
  
  # Set how many seconds to keep idle before checking for new logs.
  #
  # The default, `30`, means trigger a reading for the log every 30 seconds after entering idle.
  config :interval, :validate => :number, :default => 30

  # Set the registry create mode
  #
  # The default, `resume`, means when the registry is initially created, it assumes all logs has been handled.
  # When set to `start_over`, it will read all log files from begining.
  config :registry_create_policy, :validate => :string, :default => 'resume'

  # Sets the header of the file that does not repeat over records. Usually, these are json opening tags.
  config :file_head_bytes, :validate => :number, :default => 0

  # Sets the tail of the file that does not repeat over records. Usually, these are json closing tags.
  config :file_tail_bytes, :validate => :number, :default => 0

  # Sets the regular expression to process content before pushing the event.
  config :record_preprocess_reg_exp, :validate => :string

  # Sets the page-size for returned blob items. Too big number will hit heap overflow; Too small number will leads to too many requests.
  #
  # The default, `100` is good for default heap size of 1G.
  config :blob_list_page_size, :validate => :number, :default => 100

  # Constant of max integer
  MAX = 2 ** ([42].pack('i').size * 16 -2 ) -1

  public
  def register
    # this is the reader # for this specific instance.
    @reader = SecureRandom.uuid
    @registry_locker = "#{@registry_path}.lock"
  end # def register

  def run(queue)
    # we can abort the loop if stop? becomes true
    while !stop?
      # Setup a specific instance of an Azure::Storage::Client
      client = Azure::Storage::Client.create(:storage_account_name => @storage_account_name, :storage_access_key => @storage_access_key, :storage_blob_host => "https://#{@storage_account_name}.blob.#{@endpoint}")
      # Get an azure storage blob service object from a specific instance of an Azure::Storage::Client
      @azure_blob = client.blob_client
      # Add retry filter to the service object
      @azure_blob.with_filter(Azure::Storage::Core::Filter::ExponentialRetryPolicyFilter.new)
      @logger.info("Start process")
      process(queue)

      @logger.info("Start Recycle client")
      client = nil
      GC.start
      @logger.info("Done Recycle client")
      
      Stud.stoppable_sleep(@interval) { stop? }
    end # loop
  end # def run

  def stop
    cleanup_registry
  end # def stop
  
  # Start processing the next item.
  def process(queue)
    begin
      blob, start_index, gen = register_for_read

      if(!blob.nil?)
        begin
          blob_name = blob.name
          # Work-around: After returned by get_blob, the etag will contains quotes.
          new_etag = blob.properties[:etag]
          # ~ Work-around

          blob, header = @azure_blob.get_blob(@container, blob_name, {:end_range => @file_head_bytes}) if header.nil? unless @file_head_bytes.nil? or @file_head_bytes <= 0

          if start_index == 0
            # Skip the header since it is already read.
            start_index = start_index + @file_head_bytes
          else
            # Adjust the offset when it is other than first time, then read till the end of the file, including the tail.
            start_index = start_index - @file_tail_bytes
            start_index = 0 if start_index < 0
          end
          
          @logger.info("Start reading blog: #{blob_name}")
          blob, content = @azure_blob.get_blob(@container, blob_name, {:start_range => start_index} )
          @logger.info("Done reading blog: #{blob_name}")
          
          @logger.info("Start process content")
          # content will be used to calculate the new offset. Create a new variable for processed content.
          processed_content = content
          if(!@record_preprocess_reg_exp.nil?)
            reg_exp = Regexp.new(@record_preprocess_reg_exp, Regexp::MULTILINE)
            processed_content = content.sub(reg_exp, '')
          end

          # Putting header and content and tail together before pushing into event queue
          processed_content = "#{header}#{processed_content}" unless header.nil? || header.length == 0
          @logger.info("Done process content")
          
          @logger.info("Start sending events")
          @codec.decode(processed_content) do |event|
            decorate(event)
            queue << event
          end # decode
          @logger.info("Done sending events")
        ensure
          # Making sure the reader is removed from the registry even when there's exception.
          new_offset = start_index
          new_offset = 0 if start_index == @file_head_bytes
          new_offset = new_offset + content.length unless content.nil?
          new_registry_item = LogStash::Inputs::RegistryItem.new(blob_name, new_etag, nil, new_offset, gen)
          update_registry(new_registry_item)
        end # begin
      end # if
    rescue StandardError => e
      @logger.error("Oh My, An error occurred. \nError:#{e}:\nTrace:\n#{e.backtrace}", :exception => e)
    end # begin
  end # process

  # Deserialize registry hash from json string.
  def deserialize_registry_hash (json_string)
    result = Hash.new
    temp_hash = JSON.parse(json_string)
    temp_hash.values.each { |kvp|
      result[kvp['file_path']] = LogStash::Inputs::RegistryItem.new(kvp['file_path'], kvp['etag'], kvp['reader'], kvp['offset'], kvp['gen'])
    }
    return result
  end #deserialize_registry_hash

  # List all the blobs in the given container.
  def list_all_blobs
    blobs = Set.new []
    continuation_token = NIL
    @blob_list_page_size = 100 if @blob_list_page_size <= 0
    loop do
      # Need to limit the returned number of the returned entries to avoid out of memory exception.
      entries = @azure_blob.list_blobs(@container, { :timeout => 10, :marker => continuation_token, :max_results => @blob_list_page_size })
      entries.each do |entry|
        blobs << entry
      end # each
      continuation_token = entries.continuation_token
      break if continuation_token.empty?
    end # loop
    return blobs
  end # def list_blobs

  # Raise generation for blob in registry
  def raise_gen(registry_hash, file_path)
    begin
      target_item = registry_hash[file_path]
      begin
        target_item.gen += 1
        # Protect gen from overflow.
        target_item.gen = target_item.gen / 2 if target_item.gen == MAX
      rescue StandardError => e
        @logger.error("Fail to get the next generation for target item #{target_item}.", :exception => e)
        target_item.gen = 0
      end

      min_gen_item = registry_hash.values.min_by { |x| x.gen }
      while min_gen_item.gen > 0
        registry_hash.values.each { |value| 
          value.gen -= 1
        }
        min_gen_item = registry_hash.values.min_by { |x| x.gen }
      end
    end
  end # raise_gen

  # Acquire a lease on a blob item with retries.
  #
  # By default, it will retry 30 times with 1 second interval.
  def acquire_lease(blob_name, retry_times = 30, interval_sec = 1)
    lease = nil;
    retried = 0;
    while lease.nil? do
      begin
        lease = @azure_blob.acquire_blob_lease(@container, blob_name, {:timeout => 10})
      rescue StandardError => e
        if(e.type == 'LeaseAlreadyPresent')
            if (retried > retry_times)
                raise
            end
            retried += 1
            sleep interval_sec
        end
      end
    end #while
    return lease
  end # acquire_lease

  # Return the next blob for reading as well as the start index.
  def register_for_read
    begin
      all_blobs = list_all_blobs
      registry = all_blobs.find { |item| item.name.downcase == @registry_path  }
      registry_locker = all_blobs.find { |item| item.name.downcase == @registry_locker }

      candidate_blobs = all_blobs.select { |item| (item.name.downcase != @registry_path) && ( item.name.downcase != @registry_locker ) }
      
      start_index = 0
      gen = 0
      lease = nil

      # Put lease on locker file than the registy file to allow update of the registry as a workaround for Azure Storage Ruby SDK issue # 16.
      # Workaround: https://github.com/Azure/azure-storage-ruby/issues/16
      registry_locker = @azure_blob.create_block_blob(@container, @registry_locker, @reader) if registry_locker.nil?
      lease = acquire_lease(@registry_locker)
      # ~ Workaround

      if(registry.nil?)
        registry_hash = create_registry(candidate_blobs)
      else
        registry_hash = load_registry
      end #if
        
      picked_blobs = Set.new []
      # Pick up the next candidate
      picked_blob = nil
      candidate_blobs.each { |candidate_blob|
        registry_item = registry_hash[candidate_blob.name]

        # Appending items that doesn't exist in the hash table
        if registry_item.nil?
          registry_item = LogStash::Inputs::RegistryItem.new(candidate_blob.name, candidate_blob.properties[:etag], nil, 0, 0)
          registry_hash[candidate_blob.name] = registry_item
        end # if
        
        if ((registry_item.offset < candidate_blob.properties[:content_length]) && (registry_item.reader.nil? || registry_item.reader == @reader))
          picked_blobs << candidate_blob
        end
      }

      picked_blob = picked_blobs.min_by { |b| registry_hash[b.name].gen }
      if !picked_blob.nil?
        registry_item = registry_hash[picked_blob.name]
        registry_item.reader = @reader
        registry_hash[picked_blob.name] = registry_item
        start_index = registry_item.offset
        raise_gen(registry_hash, picked_blob.name)
        gen = registry_item.gen
      end #if

      # Save the chnage for the registry
      save_registry(registry_hash)
      
      @azure_blob.release_blob_lease(@container, @registry_locker, lease)
      lease = nil;

      return picked_blob, start_index, gen
    rescue StandardError => e
      @logger.error("Oh My, An error occurred. #{e}:\n#{e.backtrace}", :exception => e)
      return nil, nil, nil
    ensure
      @azure_blob.release_blob_lease(@container, @registry_locker, lease) unless lease.nil?
      lease = nil
    end # rescue
  end #register_for_read

  # Update the registry
  def update_registry (registry_item)
    begin
      lease = nil
      lease = acquire_lease(@registry_locker)
      registry_hash = load_registry
      registry_hash[registry_item.file_path] = registry_item
      save_registry(registry_hash)
      @azure_blob.release_blob_lease(@container, @registry_locker, lease)
      lease = nil
    rescue StandardError => e
      @logger.error("Oh My, An error occurred. #{e}:\n#{e.backtrace}", :exception => e)
    ensure
      @azure_blob.release_blob_lease(@container, @registry_locker, lease) unless lease.nil?
      lease = nil
    end #rescue
  end # def update_registry

  # Clean up the registry.
  def cleanup_registry
    begin
      lease = nil
      lease = acquire_lease(@registry_locker)
      registry_hash = load_registry
      registry_hash.each { | key, registry_item|
        registry_item.reader = nil if registry_item.reader == @reader
      }
      save_registry(registry_hash)
      @azure_blob.release_blob_lease(@container, @registry_locker, lease)
      lease = nil
    rescue StandardError => e
      @logger.error("Oh My, An error occurred. #{e}:\n#{e.backtrace}", :exception => e)
    ensure
      @azure_blob.release_blob_lease(@container, @registry_locker, lease) unless lease.nil?
      lease = nil
    end #rescue
  end # def cleanup_registry

  # Create a registry file to coordinate between multiple azure blob inputs.
  def create_registry (blob_items)
    registry_hash = Hash.new

    blob_items.each do |blob_item|
        initial_offset = 0
        initial_offset = blob_item.properties[:content_length] if @registry_create_policy == 'resume'
        registry_item = LogStash::Inputs::RegistryItem.new(blob_item.name, blob_item.properties[:etag], nil, initial_offset, 0)
      registry_hash[blob_item.name] = registry_item
    end # each
    save_registry(registry_hash)
    return registry_hash
  end # create_registry

  # Load the content of the registry into the registry hash and return it.
  def load_registry
    # Get content
    registry_blob, registry_blob_body = @azure_blob.get_blob(@container, @registry_path)
    registry_hash = deserialize_registry_hash(registry_blob_body)
    return registry_hash
  end # def load_registry

  # Serialize the registry hash and save it.
  def save_registry(registry_hash)
    # Serialize hash to json
    registry_hash_json = JSON.generate(registry_hash)

    # Upload registry to blob
    @azure_blob.create_block_blob(@container, @registry_path, registry_hash_json)
  end # def save_registry
end # class LogStash::Inputs::LogstashInputAzureblob
