var All = (function() {
  var groups = {};
  return {
    final: function( group, handler ) {
      if( !groups[group] ) {
        groups[group] = { count:0, final:null };
      }
      groups[group].final = handler;
    },
    group: function( group, handler ) {
      if( !groups[group] ) {
        groups[group] = { count:0, final:null };
      }
      groups[group].count++;

      // wrap the event handler
      return function() {
        handler.apply(this,arguments);
        if( (--groups[group].count ) == 0 ) {
          if( groups[group].final ) {
            groups[group].final();
          }
        }
      }
    }
  }
})();
