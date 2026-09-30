/* ── Journey Map Engine ──
   The world is three fixed strips (segments / monuments / flora), each translated by
   the camera at its own depth factor. Art is anchored to its chapter: we compute the
   scroll position at which a chapter centres, and place its art so the two meet.
   Reduced motion pins every factor to 1 — the world scrolls with the page, nothing
   drifts. No WebGL, no libraries; transforms and opacity only. */
(function(){
  /* .jrun gates every hiding rule: content can only hide when this engine is
     provably running — a missing/failed journey.js leaves a readable page. */
  document.documentElement.classList.add('jrun');

  /* chapter beats + monument chips arrive as you travel (wired before anything
     can bail, so reveals work even if the world markup is absent) */
  if('IntersectionObserver' in window){
    var io=new IntersectionObserver(function(es){
      es.forEach(function(e){ if(e.isIntersecting){ e.target.classList.add('on'); io.unobserve(e.target); } });
    },{threshold:.22});
    [].slice.call(document.querySelectorAll('.jbeat')).forEach(function(el){ io.observe(el); });
  } else {
    [].slice.call(document.querySelectorAll('.jbeat')).forEach(function(el){ el.classList.add('on'); });
  }

  var world=document.querySelector('.jworld');
  if(!world) return;
  var reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  var strips=[].slice.call(world.querySelectorAll('.jw-strip'));
  var chaps={};
  [].slice.call(document.querySelectorAll('.jchap')).forEach(function(c){ chaps[c.id]=c; });

  function factor(st){ return reduced ? 1 : parseFloat(st.getAttribute('data-f')||'1'); }

  /* Every art element's position is measured ONCE per layout into `items`, so the
     scroll loop never touches the DOM for reads — it only writes transforms and
     culls. Reading offsetTop/offsetHeight per frame would force synchronous layout
     on every scroll tick, which is what makes a phone stutter. */
  var items=[], vh=innerHeight||1;

  /* One scale for ALL monuments, worked out from the tightest chapter, so every landmark
     keeps its relative size and none of them changes size while you scroll. Depends only
     on card heights (stable) — never on when a picture happens to finish downloading. */
  function monScale(vh, vw){
    var gap=Math.max(10, vh*0.02), s=1;
    [].slice.call(document.querySelectorAll('.jw-mon')).forEach(function(el){
      var ch=chaps[el.getAttribute('data-chap')];
      if(!ch) return;
      var card=ch.querySelector('.jbeat');
      if(!card || card.className.indexOf('jcard')<0) return;   // scrim chapters don't constrain
      var hvh=parseFloat(el.getAttribute('data-hvh')||'0'); if(!hvh) return;
      var ar=parseFloat(el.getAttribute('data-ar')||'0')||1;
      var want=hvh*vh/100;
      var cardW=card.offsetWidth, side=(vw-cardW)/2-gap*2;
      if(side>=want*ar) return;                               // fits beside the card at full size
      var band=(vh-card.offsetHeight)/2-gap*1.6;              // else must fit above it
      if(band>0) s=Math.min(s, band/want);
    });
    return Math.max(0.35, Math.min(1, s));
  }

  function layout(){
    vh=innerHeight||1;
    items=[];
    var vw=innerWidth||1;
    var mscale=monScale(vh, vw);
    strips.forEach(function(st){
      var f=factor(st);
      [].slice.call(st.children).forEach(function(el){
        var ch=chaps[el.getAttribute('data-chap')];
        if(!ch) return;
        var sc=ch.offsetTop + ch.offsetHeight/2 - vh/2;          // scrollY at chapter centre
        var anchor=parseFloat(el.getAttribute('data-anchor')||'0.5');
        var dy=parseFloat(el.getAttribute('data-dy')||'0')*vh/100;
        var hvh=parseFloat(el.getAttribute('data-hvh')||'0');
        var mon=el.className.indexOf('jw-mon')>-1;
        var top, h;

        var card=ch.querySelector('.jbeat');
        /* Only OPAQUE chapter cards hide the art behind them. The hero's text sits on a
           soft scrim instead, so its monument must keep the placement the artwork was
           composed for — otherwise it floats off into the sky. */
        if(mon && hvh && card && card.className.indexOf('jcard')>-1){
          /* Place the monument where the card is NOT: beside it when the screen is wide
             enough, otherwise in the clear band above it (phones, where the card is
             nearly full width). Measured from the real card, so it adapts to any
             device instead of relying on hand-tuned offsets. */
          var cardH=card.offsetHeight, cardW=card.offsetWidth;
          var gap=Math.max(10, vh*0.02);
          var cardLeft=(vw-cardW)/2, cardRight=cardLeft+cardW;
          var right=parseFloat(el.getAttribute('data-x')||'50')>=50;
          var ar=parseFloat(el.getAttribute('data-ar')||'0')||1;
          h=hvh*vh/100;
          var w=h*ar;                                    // from the file's real aspect, not the DOM
          if(((right?vw-cardRight:cardLeft)-gap*2) < w){ h*=mscale; w=h*ar; }  // must go above
          el.style.height=h+'px';
          if(((right?vw-cardRight:cardLeft)-gap*2) >= w){
            top = sc*f + vh/2 - h*anchor + dy;           // beside the card, in its composed spot
            el.style.left=Math.round(right ? Math.min(vw-gap-w, cardRight+gap)
                                           : Math.max(gap, cardLeft-gap-w))+'px';
          } else {
            top = sc*f + Math.max(gap, (vh-cardH)/2-gap-h);   // clear band above the card
            var want=(parseFloat(el.getAttribute('data-x')||'50')/100)*vw;
            el.style.left=Math.round(Math.max(gap, Math.min(want, vw-w-gap)))+'px';
          }
        } else {
          if(mon && hvh) el.style.height=hvh+'vh';       // restore on resize back to desktop
          h=el.offsetHeight || vh;
          top = sc*f + vh/2 - h*anchor + dy;
          var x=el.getAttribute('data-x');
          if(x!==null) el.style.left=x+'%';
        }
        el.style.top=top+'px';
        items.push({el:el,top:top,h:h,f:f,far:null});
      });
    });
  }


  var ticking=false;
  function frame(){
    ticking=false;
    var y=scrollY||window.pageYOffset||0;
    strips.forEach(function(st){
      st.style.transform='translate3d(0,'+(-y*factor(st)).toFixed(1)+'px,0)';
    });
    /* cull: anything more than half a screen outside the viewport is not painted.
       Class is only touched when the state actually changes. */
    var pad=vh*0.2;   // safe to keep tight: hidden art stays decoded, so re-showing is instant
    for(var i=0;i<items.length;i++){
      var it=items[i], vy=it.top - y*it.f;
      var far=(vy > vh+pad) || (vy + it.h < -pad);
      if(far!==it.far){ it.el.classList.toggle('far',far); it.far=far; }
    }
  }
  function onScroll(){ if(!ticking){ ticking=true; requestAnimationFrame(frame); } }

  addEventListener('scroll',onScroll,{passive:true});
  addEventListener('resize',function(){ layout(); frame(); });
  addEventListener('load',function(){ layout(); frame(); });
  layout(); frame();

  /* if the artwork can't load at all, fold the world away — the page still reads */
  var dead=0, segs=[].slice.call(world.querySelectorAll('.jw-seg img'));
  segs.forEach(function(im){
    var f=function(){ if(++dead>=3) world.style.display='none'; };
    if(im.complete&&im.naturalWidth===0&&im.src) f(); else im.addEventListener('error',f);
  });

  /* NOTE: deliberately no relayout when art loads. Every size the engine needs is known
     up front (segments carry width/height, monuments carry data-ar), so laying out again
     on each lazy image would only cause monuments to visibly resize mid-scroll and force
     a synchronous reflow at the worst possible moment. */

  window.__journey={layout:layout,frame:frame,strips:strips};
})();
