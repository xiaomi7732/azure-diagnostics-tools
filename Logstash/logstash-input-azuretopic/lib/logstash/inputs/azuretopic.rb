# encoding: utf-8
require "logstash/inputs/base"
require "logstash/namespace"

require "azure"

# Reads events from Azure topics
class LogStash::Inputs::Azuretopic < LogStash::Inputs::Base
  class Interrupted < StandardError; end

  config_name "azuretopic"
  milestone 1

  default :codec, "json"

  config :namespace, :validate => :string
  config :access_key_name, :validate => :string, :required => false
  config :access_key, :validate => :string
  config :subscription, :validate => :string
  config :topic, :validate => :string
  config :deliverycount, :validate => :number, :default => 10
  config :metadata_enabled, :validate => :boolean, :default => false

  def initialize(*args)
  super(*args)
  end # def initialize

  public
  def register
    Azure.configure do |config|
      config.sb_namespace = @namespace
      config.sb_access_key = @access_key
      config.sb_sas_key_name = @access_key_name
      config.sb_sas_key = @access_key
    end
    if access_key_name 
        # SAS key used 
        signer = Azure::ServiceBus::Auth::SharedAccessSigner.new
        sb_host = "https://#{Azure.sb_namespace}.servicebus.windows.net"
        @azure_service_bus = Azure::ServiceBus::ServiceBusService.new(sb_host, { signer: signer})
    else
        # ACS key 
        @azure_service_bus = Azure::ServiceBus::ServiceBusService.new
    end
  end # def register

  def process(output_queue)
    message = @azure_service_bus.receive_subscription_message(@topic ,@subscription, { :peek_lock => true, :timeout => 1 } )
    if message
      codec.decode(message.body) do |event|
        decorate(event)
        if @metadata_enabled
            event.set("[@metadata][headers]", { 
                    :content_type => message.content_type,
                    :correlation_id => message.correlation_id,
                    :session_id => message.session_id,
                    :delivery_count => message.delivery_count,
                    :locked_until_utc => message.locked_until_utc,
                    :lock_token => message.lock_token,
                    :message_id => message.message_id,
                    :label => message.label,
                    :reply_to => message.reply_to,
                    :enqueued_time_utc => message.enqueued_time_utc,
                    :sequence_number => message.sequence_number,
                    :time_to_live => message.time_to_live,
                    :to => message.to,
                    :scheduled_enqueue_time_utc => message.scheduled_enqueue_time_utc,
                    :reply_to_session_id => message.reply_to_session_id,
                    :location => message.location.to_s
                })
            event.set("[@metadata][properties]", message.properties || {})
        end
        output_queue << event
      end # codec.decode
      @azure_service_bus.delete_subscription_message(message)
    end
    rescue LogStash::ShutdownSignal => e
      raise e
    rescue => e
      @logger.error("Oh My, An error occurred.", :exception => e)
    if message and message.delivery_count > @deliverycount
      @azure_service_bus.delete_subscription_message(message)
    end
  end # def process

  public
  def run(output_queue)
    while !stop?
      process(output_queue)
    end # loop
  end # def run

  public
  def teardown
  end # def teardown
end # class LogStash::Inputs::Azuretopic