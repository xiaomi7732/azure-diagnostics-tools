# encoding: utf-8
require "logstash/outputs/base"
require "logstash/namespace"

require "application_insights"

class LogStash::Outputs::ApplicationInsights < LogStash::Outputs::Base
  config_name "applicationinsights"

  config :ikey, :validate => :string, :required => true
  config :dev_mode, :validate => :boolean, :required => false, :default => false
  config :ai_message_field, :validate => :string, :required => false, :default => nil
  config :ai_properties_field, :validate => :string, :required => false, :default => nil

  public
  def register
     create_client
  end # def register

  public
  def multi_receive(events)
    events.each do |event|
      begin
        ai_message = nil
        unless @ai_message_field.nil?
          ai_message = event[@ai_message_field]   # Extracts specified field value as the AI Message.
        end #unless
        
        ai_properties = event.to_hash.fetch(@ai_properties_field, nil)
        if !@ai_message_field.nil? && ai_message.nil?
          @logger.warn("#{@ai_message_field} specified in ai_message_field not found in event data. AI Message will be null.")
        end # if
        
        ai_properties = event.to_hash.fetch(@ai_properties_field, nil)
        if !@ai_properties_field.nil? && ai_properties.nil?
          @logger.warn("#{@ai_properties_field} specified in ai_properties_field not found in event data. Will use all fields in event as AI properties.")
        end # if
        
        unless @ai_message_field.nil? || ai_message.nil?
          event.remove(@ai_message_field) # Removes the duplicated AI Message field.
        end #unless

        @client.track_trace(ai_message, Channel::Contracts::SeverityLevel::INFORMATION, { :properties => ai_properties || event.to_hash })

        if dev_mode
          @client.flush
        end # if dev_mode
        
      rescue => e
        @logger.error("Error occurred sending data to AI.", :exception => e)
      end # begin
    end # do 
  end # def multi_receive
  
  def close
    @client.flush
  end

  def create_client
    @client = TelemetryClient.new @ikey
  end # def create_client

end # LogStash::Outputs::ApplicationInsights