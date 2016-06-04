# encoding: utf-8
require "logstash/outputs/base"
require "logstash/namespace"

require "application_insights"

class LogStash::Outputs::ApplicationInsights < LogStash::Outputs::Base
    config_name "applicationinsights"

    config :ikey, :validate => :string, :required => true

    public
    def register
    end # def register

    public
    def multi_receive(events)
    end # def multi_receive
    
    public
    def receive(event)
    end # def receive

end # LogStash::Outputs::ApplicationInsights