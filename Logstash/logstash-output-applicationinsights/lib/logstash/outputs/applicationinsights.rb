# encoding: utf-8
require "logstash/outputs/base"
require "logstash/namespace"

require "application_insights"

class LogStash::Outputs::ApplicationInsights < LogStash::Outputs::Base
  config_name "applicationinsights"

  config :ikey, :validate => :string, :required => true
  config :dev_mode, :validate => :boolean, :required => false, :default => false

  public
  def register
     create_client
  end # def register

  public
  def multi_receive(events)
    events.each do |event|
      $stdout.write("#{event.to_hash.fetch('properties', 'No properties found.')}\n\n")
      @client.track_trace("LogStash Trace", Channel::Contracts::SeverityLevel::INFORMATION, { :properties => event.to_hash.fetch('properties', event.to_hash) })
      
      if dev_mode
        @client.flush
      end # if dev_mode
    end
  end # def multi_receive
  
  def close
    @client.flush
  end

  def create_client
    @client = TelemetryClient.new @ikey
  end # def create_client

end # LogStash::Outputs::ApplicationInsights