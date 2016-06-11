# encoding: utf-8
require "logstash/outputs/base"
require "logstash/namespace"
require "application_insights"

include ApplicationInsights
include ApplicationInsights::Channel

class LogStash::Outputs::ApplicationInsights < LogStash::Outputs::Base
  config_name "applicationinsights"

  config :ikey, :validate => :string, :required => true
  config :dev_mode, :validate => :boolean, :required => false, :default => false
  config :ai_message_field, :validate => :string, :required => false, :default => nil
  config :ai_properties_field, :validate => :string, :required => false, :default => nil
  config :ai_severity_level_field, :validate => :string, :required => false, :default => nil
  config :ai_severity_level_mapping, :validate => :hash, :required => false, :default => nil

  public
  def register
     create_client
  end # def register

  public
  def multi_receive(events)
    events.each do |event|
      begin
        ai_message = get_ai_message(event)
        ai_properties = get_ai_properties(event)
        ai_severity = get_ai_severity(event)

        @client.track_trace(ai_message, ai_severity, { :properties => ai_properties })
        @client.flush if @dev_mode

      rescue => e
        @logger.error("Error occurred sending data to AI.", :exception => e)
      end # begin
    end # do 
  end # def multi_receive
  
  def close
    @client.flush
  end # def close

  def create_client
    telemetry_context = TelemetryContext.new
    async_queue = AsynchronousQueue.new(AsynchronousSender.new)
    telemetry_channel = TelemetryChannel.new(telemetry_context, async_queue)
    @client = TelemetryClient.new(@ikey, telemetry_channel)
  end # def create_client
  
  def get_ai_message(event)
    return nil if @ai_message_field.nil?
    
    ai_message = event[@ai_message_field] # Extracts specified field value as the AI Message.
    @logger.warn("#{@ai_message_field} specified in ai_message_field not found in event data. AI Message will be null.") if ai_message.nil?
    event.remove(@ai_message_field) unless ai_message.nil?  # Removes the duplicated AI Message field.
    ai_message
  end # def get_ai_message
  
  def get_ai_properties(event)
    ai_properties = event.to_hash.fetch(@ai_properties_field, nil)
    if !@ai_properties_field.nil? && ai_properties.nil?
      @logger.warn("#{@ai_properties_field} specified in ai_properties_field not found in event data. Will use all fields in event as AI properties.")
    end # if

    ai_properties || event.to_hash
  end # def get_ai_properties
  
  def get_ai_severity(event)
    return nil if @ai_severity_level_field.nil? 

    severity_value = event[@ai_severity_level_field]

    if !@ai_severity_level_mapping.nil? && @ai_severity_level_mapping.any?
      ai_severity_level = @ai_severity_level_mapping.fetch(severity_value, nil)
    else
      ai_severity_level = severity_value
    end # unless

    if ai_severity_level.nil?
      @logger.warn("Cannot map value '#{severity_value}' from '#{@ai_severity_level_field}' to AI severity level. Will use default value.")
    else
      event.remove(@ai_severity_level_field)  # Removes the duplicated severity field.
    end # if
    
    ai_severity_level
  end # def get_ai_severity

end # LogStash::Outputs::ApplicationInsights