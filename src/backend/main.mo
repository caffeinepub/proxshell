import OutCall "http-outcalls/outcall";
import Text "mo:core/Text";
import Error "mo:core/Error";

actor {
  public query func transform(input : OutCall.TransformationInput) : async OutCall.TransformationOutput {
    OutCall.transform(input);
  };

  public shared ({ caller }) func getURL(url : Text) : async Text {
    try {
      await OutCall.httpGetRequest(url, [], transform);
    } catch (err : Error.Error) {
      err.message();
    };
  };

  public shared ({ caller }) func postURL(url : Text, body : Text) : async Text {
    try {
      await OutCall.httpPostRequest(url, [], body, transform);
    } catch (err : Error.Error) {
      err.message();
    };
  };
};
