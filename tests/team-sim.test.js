// Mission Sprint model tests. Run: node --test "tests/*.test.js"
const test = require('node:test');
const assert = require('node:assert');
const sim = require('../js/team/sim.js');
const data = require('../js/team/data.js');
require('../js/team/ar-sim.js');

// Winning designs found by the archetype search (docs/TEAM-BALANCE.md).
// [scenario, difficulty, requirement, orbit|instruments, picks]
const WINNERS = [
["europa","cadet","ocean","tour|iceRadar+mag",{"orbit":"tour","launcher":"medium","route":"veega","lifetime":"y2","schedule":"plan","ascent":"a150","rover":"none","structure":"vault75","panels":"p70","batteries":"b2000","adcs":"wheels","computer":"single","propMargin":"m10","turrets":"t2","oxygen":"o1","instruments":["iceRadar","mag"],"duty":"d30","processing":"compress","weapons":["laser"],"drill":"hand","antenna":"a3","radio":"r100","ground":"g1","coding":"robust","recorder":"rec64","drones":"dr0","medkits":"mk2"}],
["europa","cadet","ocean","tour|iceRadar+sounder+mag",{"orbit":"tour","launcher":"medium","route":"veega","lifetime":"y2","schedule":"plan","ascent":"a150","rover":"none","structure":"vault75","panels":"tj60","batteries":"b800","adcs":"wheels","computer":"single","propMargin":"m25","turrets":"t2","oxygen":"o1","instruments":["iceRadar","sounder","mag"],"duty":"d30","processing":"compress","weapons":["laser"],"drill":"hand","antenna":"a3","radio":"r100","ground":"g2","coding":"robust","recorder":"rec64","drones":"dr0","medkits":"mk2"}],
["europa","cadet","shell","tour|iceRadar+context",{"orbit":"tour","launcher":"medium","route":"veega","lifetime":"y2","schedule":"plan","ascent":"a150","rover":"none","structure":"vault75","panels":"p70","batteries":"b2000","adcs":"wheels","computer":"single","propMargin":"m25","turrets":"t2","oxygen":"o1","instruments":["iceRadar","context"],"duty":"d60","processing":"compress","weapons":["laser"],"drill":"hand","antenna":"a3","radio":"r100","ground":"g1","coding":"robust","recorder":"rec64","drones":"dr0","medkits":"mk2"}],
["europa","cadet","shell","tour|iceRadar+hires",{"orbit":"tour","launcher":"medium","route":"veega","lifetime":"y2","schedule":"plan","ascent":"a150","rover":"none","structure":"vault75","panels":"tj60","batteries":"b800","adcs":"wheels","computer":"single","propMargin":"m10","turrets":"t2","oxygen":"o1","instruments":["iceRadar","hires"],"duty":"d60","processing":"compress","weapons":["laser"],"drill":"hand","antenna":"a2","radio":"r100","ground":"g2","coding":"robust","recorder":"rec64","drones":"dr0","medkits":"mk2"}],
["europa","director","ocean","tour|iceRadar+sounder+mag",{"orbit":"tour","launcher":"medium","route":"veega","lifetime":"y4","schedule":"plan","ascent":"a150","rover":"none","structure":"vault150","panels":"tj60","batteries":"b2000","adcs":"wheels","computer":"single","propMargin":"m10","turrets":"t2","oxygen":"o1","instruments":["iceRadar","sounder","mag"],"duty":"d30","processing":"smart","weapons":["laser"],"drill":"hand","antenna":"a3","radio":"r50","ground":"g1","coding":"robust","recorder":"rec64","drones":"dr0","medkits":"mk2"}],
["europa","director","ocean","tour|sounder+mag+context",{"orbit":"tour","launcher":"medium","route":"veega","lifetime":"y4","schedule":"plan","ascent":"a150","rover":"none","structure":"vault150","panels":"p70","batteries":"b800","adcs":"wheels","computer":"single","propMargin":"m25","turrets":"t2","oxygen":"o1","instruments":["sounder","mag","context"],"duty":"d30","processing":"smart","weapons":["laser"],"drill":"hand","antenna":"a3","radio":"r50","ground":"g1","coding":"robust","recorder":"rec64","drones":"dr0","medkits":"mk2"}],
["europa","director","shell","orbit|iceRadar+context+irspec",{"orbit":"orbit","launcher":"heavy","route":"veega","lifetime":"y1","schedule":"plan","ascent":"a150","rover":"none","structure":"vault150","panels":"p70","batteries":"b300","adcs":"wheels","computer":"single","propMargin":"m10","turrets":"t2","oxygen":"o1","instruments":["iceRadar","context","irspec"],"duty":"d60","processing":"smart","weapons":["laser"],"drill":"hand","antenna":"a4","radio":"r100","ground":"g1","coding":"robust","recorder":"rec64","drones":"dr0","medkits":"mk2"}],
["europa","director","shell","tour|iceRadar+sounder+context",{"orbit":"tour","launcher":"medium","route":"veega","lifetime":"y2","schedule":"plan","ascent":"a150","rover":"none","structure":"vault75","panels":"tj60","batteries":"b800","adcs":"wheels","computer":"single","propMargin":"m25","turrets":"t2","oxygen":"o1","instruments":["iceRadar","sounder","context"],"duty":"d60","processing":"smart","weapons":["laser"],"drill":"hand","antenna":"a4","radio":"r50","ground":"g1","coding":"robust","recorder":"rec64","drones":"dr0","medkits":"mk2"}],
["europa","director","shell","tour|iceRadar+sounder+hires",{"orbit":"tour","launcher":"medium","route":"veega","lifetime":"y4","schedule":"plan","ascent":"a150","rover":"none","structure":"vault150","panels":"tj60","batteries":"b2000","adcs":"wheels","computer":"single","propMargin":"m10","turrets":"t2","oxygen":"o1","instruments":["iceRadar","sounder","hires"],"duty":"d60","processing":"compress","weapons":["laser"],"drill":"hand","antenna":"a4","radio":"r50","ground":"g1","coding":"robust","recorder":"rec64","drones":"dr0","medkits":"mk2"}],
["europa","engineer","ocean","orbit|iceRadar+mag",{"orbit":"orbit","launcher":"heavy","route":"veega","lifetime":"y1","schedule":"plan","ascent":"a150","rover":"none","structure":"vault75","panels":"p70","batteries":"b300","adcs":"wheels","computer":"radhard","propMargin":"m10","turrets":"t2","oxygen":"o1","instruments":["iceRadar","mag"],"duty":"d30","processing":"smart","weapons":["laser"],"drill":"hand","antenna":"a3","radio":"r100","ground":"g1","coding":"robust","recorder":"rec64","drones":"dr0","medkits":"mk2"}],
["europa","engineer","ocean","orbit|sounder+mag",{"orbit":"orbit","launcher":"heavy","route":"veega","lifetime":"y1","schedule":"plan","ascent":"a150","rover":"none","structure":"vault75","panels":"p40","batteries":"b2000","adcs":"wheels","computer":"radhard","propMargin":"m10","turrets":"t2","oxygen":"o1","instruments":["sounder","mag"],"duty":"d30","processing":"smart","weapons":["laser"],"drill":"hand","antenna":"a3","radio":"r100","ground":"g1","coding":"robust","recorder":"rec64","drones":"dr0","medkits":"mk2"}],
["europa","engineer","ocean","tour|iceRadar+mag",{"orbit":"tour","launcher":"medium","route":"veega","lifetime":"y4","schedule":"plan","ascent":"a150","rover":"none","structure":"vault75","panels":"p70","batteries":"b300","adcs":"wheels","computer":"radhard","propMargin":"m10","turrets":"t2","oxygen":"o1","instruments":["iceRadar","mag"],"duty":"d30","processing":"smart","weapons":["laser"],"drill":"hand","antenna":"a2","radio":"r50","ground":"g1","coding":"robust","recorder":"rec64","drones":"dr0","medkits":"mk2"}],
["europa","engineer","ocean","tour|iceRadar+mag+context",{"orbit":"tour","launcher":"medium","route":"veega","lifetime":"y2","schedule":"plan","ascent":"a150","rover":"none","structure":"vault75","panels":"tj60","batteries":"b300","adcs":"wheels","computer":"dual","propMargin":"m25","turrets":"t2","oxygen":"o1","instruments":["iceRadar","mag","context"],"duty":"d30","processing":"smart","weapons":["laser"],"drill":"hand","antenna":"a3","radio":"r100","ground":"g1","coding":"robust","recorder":"rec64","drones":"dr0","medkits":"mk2"}],
["europa","engineer","shell","orbit|iceRadar+context",{"orbit":"orbit","launcher":"heavy","route":"veega","lifetime":"y1","schedule":"plan","ascent":"a150","rover":"none","structure":"vault75","panels":"p40","batteries":"b2000","adcs":"wheels","computer":"radhard","propMargin":"m10","turrets":"t2","oxygen":"o1","instruments":["iceRadar","context"],"duty":"d60","processing":"smart","weapons":["laser"],"drill":"hand","antenna":"a3","radio":"r100","ground":"g1","coding":"fast","recorder":"rec64","drones":"dr0","medkits":"mk2"}],
["europa","engineer","shell","orbit|iceRadar+context+irspec",{"orbit":"orbit","launcher":"heavy","route":"veega","lifetime":"y1","schedule":"plan","ascent":"a150","rover":"none","structure":"vault75","panels":"p70","batteries":"b300","adcs":"wheels","computer":"radhard","propMargin":"m10","turrets":"t2","oxygen":"o1","instruments":["iceRadar","context","irspec"],"duty":"d60","processing":"smart","weapons":["laser"],"drill":"hand","antenna":"a3","radio":"r100","ground":"g1","coding":"fast","recorder":"rec64","drones":"dr0","medkits":"mk2"}],
["europa","engineer","shell","tour|iceRadar+context",{"orbit":"tour","launcher":"medium","route":"veega","lifetime":"y2","schedule":"plan","ascent":"a150","rover":"none","structure":"vault75","panels":"tj60","batteries":"b300","adcs":"wheels","computer":"single","propMargin":"m10","turrets":"t2","oxygen":"o1","instruments":["iceRadar","context"],"duty":"d60","processing":"smart","weapons":["laser"],"drill":"hand","antenna":"a2","radio":"r100","ground":"g1","coding":"robust","recorder":"rec64","drones":"dr0","medkits":"mk2"}],
["europa","engineer","shell","tour|iceRadar+context+irspec",{"orbit":"tour","launcher":"medium","route":"veega","lifetime":"y2","schedule":"plan","ascent":"a150","rover":"none","structure":"vault75","panels":"tj60","batteries":"b800","adcs":"wheels","computer":"single","propMargin":"m25","turrets":"t2","oxygen":"o1","instruments":["iceRadar","context","irspec"],"duty":"d60","processing":"smart","weapons":["laser"],"drill":"hand","antenna":"a3","radio":"r100","ground":"g1","coding":"robust","recorder":"rec64","drones":"dr0","medkits":"mk2"}],
["mars","cadet","ice","polar300|sounder+context+neutron",{"orbit":"polar300","launcher":"medium","route":"capture","lifetime":"y2","schedule":"plan","ascent":"a150","rover":"none","structure":"standard","panels":"p4","batteries":"b2000","adcs":"wheels","computer":"single","propMargin":"m10","turrets":"t2","oxygen":"o1","instruments":["sounder","context","neutron"],"duty":"d90","processing":"compress","weapons":["laser"],"drill":"hand","antenna":"a3","radio":"r50","ground":"g1","coding":"robust","recorder":"rec64","drones":"dr0","medkits":"mk2"}],
["mars","cadet","ice","polar300|sounder+hires",{"orbit":"polar300","launcher":"medium","route":"capture","lifetime":"y2","schedule":"plan","ascent":"a150","rover":"none","structure":"standard","panels":"p8","batteries":"b800","adcs":"wheels","computer":"single","propMargin":"m10","turrets":"t2","oxygen":"o1","instruments":["sounder","hires"],"duty":"d90","processing":"compress","weapons":["laser"],"drill":"hand","antenna":"a3","radio":"r100","ground":"g2","coding":"robust","recorder":"rec64","drones":"dr0","medkits":"mk2"}],
["mars","cadet","sites","ellipse|hires+context+neutron",{"orbit":"ellipse","launcher":"medium","route":"capture","lifetime":"y2","schedule":"plan","ascent":"a150","rover":"none","structure":"standard","panels":"p4","batteries":"b800","adcs":"wheels","computer":"single","propMargin":"m25","turrets":"t2","oxygen":"o1","instruments":["hires","context","neutron"],"duty":"d60","processing":"compress","weapons":["laser"],"drill":"hand","antenna":"a3","radio":"r100","ground":"g1","coding":"robust","recorder":"rec64","drones":"dr0","medkits":"mk2"}],
["mars","cadet","sites","ellipse|hires+neutron",{"orbit":"ellipse","launcher":"medium","route":"capture","lifetime":"y2","schedule":"plan","ascent":"a150","rover":"none","structure":"standard","panels":"p4","batteries":"b800","adcs":"wheels","computer":"single","propMargin":"m10","turrets":"t2","oxygen":"o1","instruments":["hires","neutron"],"duty":"d60","processing":"compress","weapons":["laser"],"drill":"hand","antenna":"a3","radio":"r100","ground":"g1","coding":"robust","recorder":"rec64","drones":"dr0","medkits":"mk2"}],
["mars","cadet","sites","polar300|hires+context+neutron",{"orbit":"polar300","launcher":"medium","route":"capture","lifetime":"y2","schedule":"plan","ascent":"a150","rover":"none","structure":"standard","panels":"p4","batteries":"b2000","adcs":"wheels","computer":"single","propMargin":"m10","turrets":"t2","oxygen":"o1","instruments":["hires","context","neutron"],"duty":"d90","processing":"compress","weapons":["laser"],"drill":"hand","antenna":"a3","radio":"r50","ground":"g1","coding":"robust","recorder":"rec64","drones":"dr0","medkits":"mk2"}],
["mars","cadet","sites","polar300|hires+neutron",{"orbit":"polar300","launcher":"medium","route":"capture","lifetime":"y2","schedule":"plan","ascent":"a150","rover":"none","structure":"standard","panels":"p4","batteries":"b2000","adcs":"wheels","computer":"single","propMargin":"m10","turrets":"t2","oxygen":"o1","instruments":["hires","neutron"],"duty":"d90","processing":"compress","weapons":["laser"],"drill":"hand","antenna":"a3","radio":"r50","ground":"g1","coding":"robust","recorder":"rec64","drones":"dr0","medkits":"mk2"}],
["mars","director","ice","ellipse|iceRadar+context+neutron",{"orbit":"ellipse","launcher":"medium","route":"capture","lifetime":"y4","schedule":"plan","ascent":"a150","rover":"none","structure":"light","panels":"p4","batteries":"b800","adcs":"wheels","computer":"single","propMargin":"m25","turrets":"t2","oxygen":"o1","instruments":["iceRadar","context","neutron"],"duty":"d60","processing":"compress","weapons":["laser"],"drill":"hand","antenna":"a2","radio":"r50","ground":"g1","coding":"robust","recorder":"rec64","drones":"dr0","medkits":"mk2"}],
["mars","director","ice","ellipse|sounder+iceRadar+hires",{"orbit":"ellipse","launcher":"medium","route":"capture","lifetime":"y2","schedule":"plan","ascent":"a150","rover":"none","structure":"light","panels":"p8","batteries":"b300","adcs":"wheels","computer":"single","propMargin":"m25","turrets":"t2","oxygen":"o1","instruments":["sounder","iceRadar","hires"],"duty":"d60","processing":"smart","weapons":["laser"],"drill":"hand","antenna":"a3","radio":"r100","ground":"g1","coding":"fast","recorder":"rec64","drones":"dr0","medkits":"mk2"}],
["mars","director","sites","ellipse|sounder+hires",{"orbit":"ellipse","launcher":"medium","route":"capture","lifetime":"y4","schedule":"plan","ascent":"a150","rover":"none","structure":"light","panels":"p4","batteries":"b800","adcs":"wheels","computer":"single","propMargin":"m25","turrets":"t2","oxygen":"o1","instruments":["sounder","hires"],"duty":"d30","processing":"smart","weapons":["laser"],"drill":"hand","antenna":"a2","radio":"r50","ground":"g1","coding":"robust","recorder":"rec64","drones":"dr0","medkits":"mk2"}],
["mars","engineer","ice","ellipse|iceRadar+context+neutron",{"orbit":"ellipse","launcher":"medium","route":"capture","lifetime":"y4","schedule":"plan","ascent":"a150","rover":"none","structure":"light","panels":"p4","batteries":"b800","adcs":"wheels","computer":"single","propMargin":"m25","turrets":"t2","oxygen":"o1","instruments":["iceRadar","context","neutron"],"duty":"d60","processing":"compress","weapons":["laser"],"drill":"hand","antenna":"a2","radio":"r50","ground":"g1","coding":"robust","recorder":"rec64","drones":"dr0","medkits":"mk2"}],
["mars","engineer","ice","ellipse|iceRadar+hires+neutron",{"orbit":"ellipse","launcher":"medium","route":"capture","lifetime":"y4","schedule":"plan","ascent":"a150","rover":"none","structure":"light","panels":"p4","batteries":"b800","adcs":"wheels","computer":"single","propMargin":"m25","turrets":"t2","oxygen":"o1","instruments":["iceRadar","hires","neutron"],"duty":"d60","processing":"smart","weapons":["laser"],"drill":"hand","antenna":"a2","radio":"r50","ground":"g1","coding":"robust","recorder":"rec64","drones":"dr0","medkits":"mk2"}],
["mars","engineer","sites","ellipse|hires+context+neutron",{"orbit":"ellipse","launcher":"medium","route":"capture","lifetime":"y4","schedule":"plan","ascent":"a150","rover":"none","structure":"light","panels":"p4","batteries":"b300","adcs":"wheels","computer":"single","propMargin":"m25","turrets":"t2","oxygen":"o1","instruments":["hires","context","neutron"],"duty":"d60","processing":"smart","weapons":["laser"],"drill":"hand","antenna":"a2","radio":"r50","ground":"g1","coding":"robust","recorder":"rec64","drones":"dr0","medkits":"mk2"}],
["mars","engineer","sites","ellipse|hires+neutron",{"orbit":"ellipse","launcher":"medium","route":"capture","lifetime":"y4","schedule":"plan","ascent":"a150","rover":"none","structure":"light","panels":"p4","batteries":"b300","adcs":"star","computer":"single","propMargin":"m25","turrets":"t2","oxygen":"o1","instruments":["hires","neutron"],"duty":"d60","processing":"smart","weapons":["laser"],"drill":"hand","antenna":"a2","radio":"r25","ground":"g1","coding":"robust","recorder":"rec64","drones":"dr0","medkits":"mk2"}],
["moon","cadet","map","equator|neutron+sounder+context",{"orbit":"equator","launcher":"light","route":"direct","lifetime":"y2","schedule":"plan","ascent":"a150","rover":"none","structure":"standard","panels":"p3","batteries":"b800","adcs":"wheels","computer":"single","propMargin":"m25","turrets":"t2","oxygen":"o1","instruments":["neutron","sounder","context"],"duty":"d90","processing":"compress","weapons":["laser"],"drill":"hand","antenna":"a1","radio":"r25","ground":"g1","coding":"robust","recorder":"rec64","drones":"dr0","medkits":"mk2"}],
["moon","cadet","map","polar100|neutron+sounder",{"orbit":"polar100","launcher":"light","route":"direct","lifetime":"y1","schedule":"plan","ascent":"a150","rover":"none","structure":"standard","panels":"p3","batteries":"b800","adcs":"wheels","computer":"single","propMargin":"m25","turrets":"t2","oxygen":"o1","instruments":["neutron","sounder"],"duty":"d60","processing":"compress","weapons":["laser"],"drill":"hand","antenna":"a1","radio":"r25","ground":"g1","coding":"robust","recorder":"rec64","drones":"dr0","medkits":"mk2"}],
["moon","cadet","map","polar100|neutron+sounder+context",{"orbit":"polar100","launcher":"light","route":"direct","lifetime":"y1","schedule":"plan","ascent":"a150","rover":"none","structure":"standard","panels":"p3","batteries":"b800","adcs":"wheels","computer":"single","propMargin":"m25","turrets":"t2","oxygen":"o1","instruments":["neutron","sounder","context"],"duty":"d60","processing":"compress","weapons":["laser"],"drill":"hand","antenna":"a1","radio":"r25","ground":"g1","coding":"robust","recorder":"rec64","drones":"dr0","medkits":"mk2"}],
["moon","cadet","see","equator|neutron+sounder+hires",{"orbit":"equator","launcher":"light","route":"direct","lifetime":"y1","schedule":"plan","ascent":"a150","rover":"none","structure":"standard","panels":"p3","batteries":"b800","adcs":"wheels","computer":"single","propMargin":"m25","turrets":"t2","oxygen":"o1","instruments":["neutron","sounder","hires"],"duty":"d60","processing":"compress","weapons":["laser"],"drill":"hand","antenna":"a1","radio":"r25","ground":"g1","coding":"robust","recorder":"rec64","drones":"dr0","medkits":"mk2"}],
["moon","cadet","see","equator|sounder+hires",{"orbit":"equator","launcher":"light","route":"direct","lifetime":"y1","schedule":"plan","ascent":"a150","rover":"none","structure":"standard","panels":"p3","batteries":"b800","adcs":"wheels","computer":"single","propMargin":"m25","turrets":"t2","oxygen":"o1","instruments":["sounder","hires"],"duty":"d60","processing":"compress","weapons":["laser"],"drill":"hand","antenna":"a1","radio":"r25","ground":"g1","coding":"robust","recorder":"rec64","drones":"dr0","medkits":"mk2"}],
["moon","cadet","see","polar100|neutron+sounder+hires",{"orbit":"polar100","launcher":"light","route":"direct","lifetime":"y1","schedule":"plan","ascent":"a150","rover":"none","structure":"standard","panels":"p3","batteries":"b800","adcs":"wheels","computer":"single","propMargin":"m25","turrets":"t2","oxygen":"o1","instruments":["neutron","sounder","hires"],"duty":"d60","processing":"compress","weapons":["laser"],"drill":"hand","antenna":"a1","radio":"r25","ground":"g1","coding":"robust","recorder":"rec64","drones":"dr0","medkits":"mk2"}],
["moon","cadet","see","polar100|sounder+hires",{"orbit":"polar100","launcher":"light","route":"direct","lifetime":"y1","schedule":"plan","ascent":"a150","rover":"none","structure":"standard","panels":"p3","batteries":"b800","adcs":"wheels","computer":"single","propMargin":"m10","turrets":"t2","oxygen":"o1","instruments":["sounder","hires"],"duty":"d60","processing":"compress","weapons":["laser"],"drill":"hand","antenna":"a1","radio":"r25","ground":"g1","coding":"robust","recorder":"rec64","drones":"dr0","medkits":"mk2"}],
["moon","director","map","equator|iceRadar+context+lidar",{"orbit":"equator","launcher":"light","route":"direct","lifetime":"y1","schedule":"plan","ascent":"a150","rover":"none","structure":"light","panels":"p3","batteries":"b800","adcs":"magnet","computer":"single","propMargin":"m25","turrets":"t2","oxygen":"o1","instruments":["iceRadar","context","lidar"],"duty":"d60","processing":"compress","weapons":["laser"],"drill":"hand","antenna":"a03","radio":"r5","ground":"g1","coding":"robust","recorder":"rec64","drones":"dr0","medkits":"mk2"}],
["moon","director","map","equator|neutron+sounder+lidar",{"orbit":"equator","launcher":"light","route":"direct","lifetime":"y1","schedule":"plan","ascent":"a150","rover":"none","structure":"standard","panels":"p3","batteries":"b300","adcs":"magnet","computer":"single","propMargin":"m10","turrets":"t2","oxygen":"o1","instruments":["neutron","sounder","lidar"],"duty":"d60","processing":"compress","weapons":["laser"],"drill":"hand","antenna":"a03","radio":"r5","ground":"g1","coding":"robust","recorder":"rec64","drones":"dr0","medkits":"mk2"}],
["moon","director","map","frozen|iceRadar+context+lidar",{"orbit":"frozen","launcher":"light","route":"direct","lifetime":"y1","schedule":"plan","ascent":"a150","rover":"none","structure":"light","panels":"p3","batteries":"b300","adcs":"magnet","computer":"single","propMargin":"m25","turrets":"t2","oxygen":"o1","instruments":["iceRadar","context","lidar"],"duty":"d60","processing":"compress","weapons":["laser"],"drill":"hand","antenna":"a03","radio":"r5","ground":"g1","coding":"robust","recorder":"rec64","drones":"dr0","medkits":"mk2"}],
["moon","director","map","frozen|sounder+context+lidar",{"orbit":"frozen","launcher":"light","route":"direct","lifetime":"y1","schedule":"plan","ascent":"a150","rover":"none","structure":"standard","panels":"p3","batteries":"b300","adcs":"magnet","computer":"single","propMargin":"m25","turrets":"t2","oxygen":"o1","instruments":["sounder","context","lidar"],"duty":"d60","processing":"compress","weapons":["laser"],"drill":"hand","antenna":"a03","radio":"r5","ground":"g1","coding":"robust","recorder":"rec64","drones":"dr0","medkits":"mk2"}],
["moon","director","see","frozen|sounder+hires",{"orbit":"frozen","launcher":"light","route":"direct","lifetime":"y1","schedule":"plan","ascent":"a150","rover":"none","structure":"light","panels":"p3","batteries":"b300","adcs":"magnet","computer":"single","propMargin":"m25","turrets":"t2","oxygen":"o1","instruments":["sounder","hires"],"duty":"d60","processing":"compress","weapons":["laser"],"drill":"hand","antenna":"a03","radio":"r5","ground":"g1","coding":"robust","recorder":"rec64","drones":"dr0","medkits":"mk2"}],
["moon","director","see","polar100|sounder+hires+context",{"orbit":"polar100","launcher":"light","route":"direct","lifetime":"y1","schedule":"plan","ascent":"a150","rover":"none","structure":"light","panels":"p3","batteries":"b300","adcs":"magnet","computer":"single","propMargin":"m25","turrets":"t2","oxygen":"o1","instruments":["sounder","hires","context"],"duty":"d60","processing":"compress","weapons":["laser"],"drill":"hand","antenna":"a03","radio":"r5","ground":"g1","coding":"robust","recorder":"rec64","drones":"dr0","medkits":"mk2"}],
["moon","engineer","map","equator|context+lidar",{"orbit":"equator","launcher":"light","route":"direct","lifetime":"y3","schedule":"plan","ascent":"a150","rover":"none","structure":"standard","panels":"p3","batteries":"b300","adcs":"magnet","computer":"single","propMargin":"m25","turrets":"t2","oxygen":"o1","instruments":["context","lidar"],"duty":"d60","processing":"compress","weapons":["laser"],"drill":"hand","antenna":"a03","radio":"r5","ground":"g1","coding":"robust","recorder":"rec64","drones":"dr0","medkits":"mk2"}],
["moon","engineer","map","equator|hires+lidar",{"orbit":"equator","launcher":"light","route":"direct","lifetime":"y2","schedule":"plan","ascent":"a150","rover":"none","structure":"standard","panels":"p3","batteries":"b300","adcs":"magnet","computer":"single","propMargin":"m25","turrets":"t2","oxygen":"o1","instruments":["hires","lidar"],"duty":"d60","processing":"compress","weapons":["laser"],"drill":"hand","antenna":"a03","radio":"r5","ground":"g1","coding":"robust","recorder":"rec64","drones":"dr0","medkits":"mk2"}],
["moon","engineer","map","frozen|context+lidar",{"orbit":"frozen","launcher":"light","route":"direct","lifetime":"y3","schedule":"plan","ascent":"a150","rover":"none","structure":"standard","panels":"p3","batteries":"b300","adcs":"magnet","computer":"single","propMargin":"m25","turrets":"t2","oxygen":"o1","instruments":["context","lidar"],"duty":"d60","processing":"compress","weapons":["laser"],"drill":"hand","antenna":"a03","radio":"r5","ground":"g1","coding":"robust","recorder":"rec64","drones":"dr0","medkits":"mk2"}],
["moon","engineer","map","frozen|hires+context+lidar",{"orbit":"frozen","launcher":"light","route":"direct","lifetime":"y1","schedule":"plan","ascent":"a150","rover":"none","structure":"standard","panels":"p3","batteries":"b300","adcs":"wheels","computer":"single","propMargin":"m25","turrets":"t2","oxygen":"o1","instruments":["hires","context","lidar"],"duty":"d90","processing":"compress","weapons":["laser"],"drill":"hand","antenna":"a03","radio":"r5","ground":"g1","coding":"robust","recorder":"rec64","drones":"dr0","medkits":"mk2"}],
["moon","engineer","see","equator|hires+context+lidar",{"orbit":"equator","launcher":"light","route":"direct","lifetime":"y1","schedule":"plan","ascent":"a150","rover":"none","structure":"standard","panels":"p3","batteries":"b300","adcs":"magnet","computer":"single","propMargin":"m25","turrets":"t2","oxygen":"o1","instruments":["hires","context","lidar"],"duty":"d90","processing":"compress","weapons":["laser"],"drill":"hand","antenna":"a03","radio":"r5","ground":"g1","coding":"robust","recorder":"rec64","drones":"dr0","medkits":"mk2"}],
["moon","engineer","see","equator|hires+lidar",{"orbit":"equator","launcher":"light","route":"direct","lifetime":"y2","schedule":"plan","ascent":"a150","rover":"none","structure":"standard","panels":"p3","batteries":"b300","adcs":"magnet","computer":"single","propMargin":"m25","turrets":"t2","oxygen":"o1","instruments":["hires","lidar"],"duty":"d60","processing":"compress","weapons":["laser"],"drill":"hand","antenna":"a03","radio":"r5","ground":"g1","coding":"robust","recorder":"rec64","drones":"dr0","medkits":"mk2"}],
["moon","engineer","see","frozen|hires+context+lidar",{"orbit":"frozen","launcher":"light","route":"direct","lifetime":"y1","schedule":"plan","ascent":"a150","rover":"none","structure":"standard","panels":"p3","batteries":"b300","adcs":"magnet","computer":"single","propMargin":"m25","turrets":"t2","oxygen":"o1","instruments":["hires","context","lidar"],"duty":"d90","processing":"compress","weapons":["laser"],"drill":"hand","antenna":"a03","radio":"r5","ground":"g1","coding":"robust","recorder":"rec64","drones":"dr0","medkits":"mk2"}],
["moon","engineer","see","frozen|hires+lidar",{"orbit":"frozen","launcher":"light","route":"direct","lifetime":"y2","schedule":"plan","ascent":"a150","rover":"none","structure":"standard","panels":"p3","batteries":"b300","adcs":"magnet","computer":"single","propMargin":"m25","turrets":"t2","oxygen":"o1","instruments":["hires","lidar"],"duty":"d60","processing":"compress","weapons":["laser"],"drill":"hand","antenna":"a03","radio":"r5","ground":"g1","coding":"robust","recorder":"rec64","drones":"dr0","medkits":"mk2"}],
["nile","cadet","sharp","leo400|context+wide",{"orbit":"leo400","launcher":"light","route":"direct","lifetime":"y3","schedule":"plan","structure":"standard","panels":"p2","batteries":"b800","adcs":"wheels","computer":"single","propMargin":"m25","instruments":["context","wide"],"duty":"d60","processing":"compress","antenna":"a1","radio":"r25","ground":"g1","coding":"robust","recorder":"rec64"}],
["nile","cadet","sharp","leo400|context+wide+irspec",{"orbit":"leo400","launcher":"light","route":"direct","lifetime":"y2","schedule":"plan","structure":"standard","panels":"p2","batteries":"b800","adcs":"wheels","computer":"single","propMargin":"m25","instruments":["context","wide","irspec"],"duty":"d60","processing":"compress","antenna":"a1","radio":"r25","ground":"g1","coding":"robust","recorder":"rec64"}],
["nile","cadet","sharp","sso600|context+wide",{"orbit":"sso600","launcher":"light","route":"direct","lifetime":"y2","schedule":"plan","structure":"standard","panels":"p2","batteries":"b800","adcs":"wheels","computer":"single","propMargin":"m25","instruments":["context","wide"],"duty":"d60","processing":"compress","antenna":"a1","radio":"r25","ground":"g1","coding":"robust","recorder":"rec64"}],
["nile","cadet","sharp","sso600|context+wide+irspec",{"orbit":"sso600","launcher":"light","route":"direct","lifetime":"y2","schedule":"plan","structure":"standard","panels":"p2","batteries":"b800","adcs":"wheels","computer":"single","propMargin":"m25","instruments":["context","wide","irspec"],"duty":"d60","processing":"compress","antenna":"a1","radio":"r25","ground":"g1","coding":"robust","recorder":"rec64"}],
["nile","cadet","wide","leo400|context+irspec",{"orbit":"leo400","launcher":"light","route":"direct","lifetime":"y3","schedule":"plan","structure":"standard","panels":"p2","batteries":"b800","adcs":"wheels","computer":"single","propMargin":"m25","instruments":["context","irspec"],"duty":"d60","processing":"compress","antenna":"a1","radio":"r25","ground":"g1","coding":"robust","recorder":"rec64"}],
["nile","cadet","wide","leo400|context+wide",{"orbit":"leo400","launcher":"light","route":"direct","lifetime":"y3","schedule":"plan","structure":"standard","panels":"p2","batteries":"b800","adcs":"wheels","computer":"single","propMargin":"m25","instruments":["context","wide"],"duty":"d60","processing":"compress","antenna":"a1","radio":"r25","ground":"g1","coding":"robust","recorder":"rec64"}],
["nile","cadet","wide","sso600|context+irspec",{"orbit":"sso600","launcher":"light","route":"direct","lifetime":"y2","schedule":"plan","structure":"standard","panels":"p2","batteries":"b800","adcs":"wheels","computer":"single","propMargin":"m25","instruments":["context","irspec"],"duty":"d60","processing":"compress","antenna":"a1","radio":"r25","ground":"g1","coding":"robust","recorder":"rec64"}],
["nile","cadet","wide","sso600|context+wide",{"orbit":"sso600","launcher":"light","route":"direct","lifetime":"y2","schedule":"plan","structure":"standard","panels":"p2","batteries":"b800","adcs":"wheels","computer":"single","propMargin":"m25","instruments":["context","wide"],"duty":"d60","processing":"compress","antenna":"a1","radio":"r25","ground":"g1","coding":"robust","recorder":"rec64"}],
["nile","director","sharp","leo400|hires",{"orbit":"leo400","launcher":"light","route":"direct","lifetime":"y1","schedule":"plan","structure":"standard","panels":"p2","batteries":"b300","adcs":"magnet","computer":"single","propMargin":"m25","instruments":["hires"],"duty":"d60","processing":"compress","antenna":"a03","radio":"r25","ground":"g1","coding":"robust","recorder":"rec64"}],
["nile","director","sharp","sso600|hires",{"orbit":"sso600","launcher":"light","route":"rideshare","lifetime":"y1","schedule":"plan","structure":"standard","panels":"p2","batteries":"b300","adcs":"magnet","computer":"single","propMargin":"m25","instruments":["hires"],"duty":"d60","processing":"compress","antenna":"a03","radio":"r25","ground":"g1","coding":"robust","recorder":"rec64"}],
["nile","director","sharp","sso600|hires+context",{"orbit":"sso600","launcher":"light","route":"rideshare","lifetime":"y1","schedule":"plan","structure":"standard","panels":"p2","batteries":"b300","adcs":"magnet","computer":"single","propMargin":"m25","instruments":["hires","context"],"duty":"d60","processing":"compress","antenna":"a03","radio":"r25","ground":"g1","coding":"robust","recorder":"rec64"}],
["nile","director","wide","leo400|hires",{"orbit":"leo400","launcher":"light","route":"direct","lifetime":"y1","schedule":"plan","structure":"standard","panels":"p2","batteries":"b300","adcs":"magnet","computer":"single","propMargin":"m25","instruments":["hires"],"duty":"d60","processing":"compress","antenna":"a03","radio":"r25","ground":"g1","coding":"robust","recorder":"rec64"}],
["nile","director","wide","sso600|context+wide+irspec",{"orbit":"sso600","launcher":"light","route":"rideshare","lifetime":"y1","schedule":"plan","structure":"standard","panels":"p2","batteries":"b300","adcs":"magnet","computer":"single","propMargin":"m25","instruments":["context","wide","irspec"],"duty":"d60","processing":"compress","antenna":"a03","radio":"r5","ground":"g2","coding":"robust","recorder":"rec64"}],
["nile","director","wide","sso600|hires+context",{"orbit":"sso600","launcher":"light","route":"rideshare","lifetime":"y1","schedule":"plan","structure":"standard","panels":"p2","batteries":"b300","adcs":"magnet","computer":"single","propMargin":"m25","instruments":["hires","context"],"duty":"d60","processing":"compress","antenna":"a03","radio":"r25","ground":"g1","coding":"robust","recorder":"rec64"}],
["nile","engineer","sharp","dd650|context+wide",{"orbit":"dd650","launcher":"light","route":"direct","lifetime":"y2","schedule":"plan","structure":"standard","panels":"p2","batteries":"b300","adcs":"magnet","computer":"single","propMargin":"m25","instruments":["context","wide"],"duty":"d90","processing":"compress","antenna":"a03","radio":"r25","ground":"g1","coding":"robust","recorder":"rec64"}],
["nile","engineer","sharp","dd650|hires",{"orbit":"dd650","launcher":"light","route":"direct","lifetime":"y1","schedule":"plan","structure":"standard","panels":"p2","batteries":"b300","adcs":"wheels","computer":"single","propMargin":"m25","instruments":["hires"],"duty":"d60","processing":"compress","antenna":"a03","radio":"r25","ground":"g1","coding":"robust","recorder":"rec64"}],
["nile","engineer","sharp","geo|wide",{"orbit":"geo","launcher":"light","route":"direct","lifetime":"y2","schedule":"plan","structure":"standard","panels":"p2","batteries":"b300","adcs":"magnet","computer":"single","propMargin":"m25","instruments":["wide"],"duty":"d90","processing":"compress","antenna":"a03","radio":"r5","ground":"g1","coding":"robust","recorder":"rec64"}],
["nile","engineer","sharp","leo400|hires",{"orbit":"leo400","launcher":"light","route":"direct","lifetime":"y1","schedule":"plan","structure":"standard","panels":"p2","batteries":"b300","adcs":"magnet","computer":"single","propMargin":"m25","instruments":["hires"],"duty":"d60","processing":"compress","antenna":"a03","radio":"r25","ground":"g1","coding":"robust","recorder":"rec64"}],
["nile","engineer","wide","dd650|context+irspec",{"orbit":"dd650","launcher":"light","route":"direct","lifetime":"y2","schedule":"plan","structure":"standard","panels":"p2","batteries":"b300","adcs":"magnet","computer":"single","propMargin":"m25","instruments":["context","irspec"],"duty":"d90","processing":"compress","antenna":"a03","radio":"r5","ground":"g2","coding":"robust","recorder":"rec64"}],
["nile","engineer","wide","dd650|context+wide+irspec",{"orbit":"dd650","launcher":"light","route":"direct","lifetime":"y1","schedule":"plan","structure":"standard","panels":"p2","batteries":"b300","adcs":"magnet","computer":"single","propMargin":"m25","instruments":["context","wide","irspec"],"duty":"d90","processing":"raw","antenna":"a03","radio":"r25","ground":"g1","coding":"robust","recorder":"rec64"}],
["nile","engineer","wide","geo|context+irspec",{"orbit":"geo","launcher":"light","route":"direct","lifetime":"y2","schedule":"plan","structure":"standard","panels":"p2","batteries":"b300","adcs":"magnet","computer":"single","propMargin":"m25","instruments":["context","irspec"],"duty":"d90","processing":"compress","antenna":"a03","radio":"r5","ground":"g1","coding":"robust","recorder":"rec64"}],
["nile","engineer","wide","geo|context+wide+irspec",{"orbit":"geo","launcher":"light","route":"direct","lifetime":"y1","schedule":"plan","structure":"standard","panels":"p2","batteries":"b300","adcs":"magnet","computer":"single","propMargin":"m10","instruments":["context","wide","irspec"],"duty":"d60","processing":"compress","antenna":"a03","radio":"r5","ground":"g1","coding":"robust","recorder":"rec64"}],
["storms","cadet","early","geo|irspec",{"orbit":"geo","launcher":"light","route":"direct","lifetime":"y3","schedule":"plan","structure":"standard","panels":"p2","batteries":"b800","adcs":"wheels","computer":"single","propMargin":"m10","instruments":["irspec"],"duty":"d60","processing":"compress","antenna":"a1","radio":"r25","ground":"g1","coding":"robust","recorder":"rec64"}],
["storms","cadet","early","geo|irspec+context",{"orbit":"geo","launcher":"light","route":"direct","lifetime":"y3","schedule":"plan","structure":"standard","panels":"p2","batteries":"b800","adcs":"wheels","computer":"single","propMargin":"m25","instruments":["irspec","context"],"duty":"d60","processing":"compress","antenna":"a1","radio":"r25","ground":"g1","coding":"robust","recorder":"rec64"}],
["storms","cadet","early","polar800|irspec",{"orbit":"polar800","launcher":"light","route":"direct","lifetime":"y3","schedule":"plan","structure":"standard","panels":"p2","batteries":"b800","adcs":"wheels","computer":"single","propMargin":"m25","instruments":["irspec"],"duty":"d60","processing":"compress","antenna":"a1","radio":"r25","ground":"g1","coding":"robust","recorder":"rec64"}],
["storms","cadet","early","polar800|irspec+context",{"orbit":"polar800","launcher":"light","route":"direct","lifetime":"y3","schedule":"plan","structure":"standard","panels":"p2","batteries":"b800","adcs":"wheels","computer":"single","propMargin":"m25","instruments":["irspec","context"],"duty":"d60","processing":"compress","antenna":"a1","radio":"r25","ground":"g1","coding":"robust","recorder":"rec64"}],
["storms","cadet","track","geo|irspec+context",{"orbit":"geo","launcher":"light","route":"direct","lifetime":"y3","schedule":"plan","structure":"standard","panels":"p2","batteries":"b800","adcs":"wheels","computer":"single","propMargin":"m25","instruments":["irspec","context"],"duty":"d60","processing":"compress","antenna":"a1","radio":"r25","ground":"g1","coding":"robust","recorder":"rec64"}],
["storms","cadet","track","geo|irspec+context+hires",{"orbit":"geo","launcher":"medium","route":"direct","lifetime":"y3","schedule":"plan","structure":"standard","panels":"p2","batteries":"b800","adcs":"wheels","computer":"single","propMargin":"m25","instruments":["irspec","context","hires"],"duty":"d60","processing":"compress","antenna":"a1","radio":"r25","ground":"g1","coding":"robust","recorder":"rec64"}],
["storms","cadet","track","polar800|irspec+context",{"orbit":"polar800","launcher":"light","route":"direct","lifetime":"y3","schedule":"plan","structure":"standard","panels":"p2","batteries":"b800","adcs":"wheels","computer":"single","propMargin":"m25","instruments":["irspec","context"],"duty":"d60","processing":"compress","antenna":"a1","radio":"r25","ground":"g1","coding":"robust","recorder":"rec64"}],
["storms","cadet","track","polar800|irspec+context+hires",{"orbit":"polar800","launcher":"light","route":"direct","lifetime":"y3","schedule":"plan","structure":"standard","panels":"p2","batteries":"b800","adcs":"wheels","computer":"single","propMargin":"m25","instruments":["irspec","context","hires"],"duty":"d60","processing":"compress","antenna":"a1","radio":"r25","ground":"g1","coding":"robust","recorder":"rec64"}],
["storms","director","early","geo|irspec+context",{"orbit":"geo","launcher":"light","route":"direct","lifetime":"y3","schedule":"plan","structure":"standard","panels":"p2","batteries":"b300","adcs":"magnet","computer":"single","propMargin":"m25","instruments":["irspec","context"],"duty":"d60","processing":"compress","antenna":"a03","radio":"r5","ground":"g1","coding":"robust","recorder":"rec64"}],
["storms","director","early","geo|irspec+wide",{"orbit":"geo","launcher":"light","route":"direct","lifetime":"y3","schedule":"plan","structure":"standard","panels":"p2","batteries":"b300","adcs":"magnet","computer":"single","propMargin":"m25","instruments":["irspec","wide"],"duty":"d60","processing":"compress","antenna":"a03","radio":"r5","ground":"g1","coding":"robust","recorder":"rec64"}],
["storms","director","early","polar800|irspec",{"orbit":"polar800","launcher":"light","route":"direct","lifetime":"y5","schedule":"plan","structure":"standard","panels":"p2","batteries":"b300","adcs":"magnet","computer":"single","propMargin":"m25","instruments":["irspec"],"duty":"d60","processing":"compress","antenna":"a03","radio":"r5","ground":"g1","coding":"robust","recorder":"rec64"}],
["storms","director","early","polar800|irspec+context",{"orbit":"polar800","launcher":"light","route":"direct","lifetime":"y3","schedule":"plan","structure":"standard","panels":"p2","batteries":"b300","adcs":"magnet","computer":"single","propMargin":"m25","instruments":["irspec","context"],"duty":"d60","processing":"compress","antenna":"a03","radio":"r5","ground":"g1","coding":"robust","recorder":"rec64"}],
["storms","director","track","sso600|irspec+hires",{"orbit":"sso600","launcher":"light","route":"direct","lifetime":"y3","schedule":"plan","structure":"standard","panels":"p2","batteries":"b300","adcs":"magnet","computer":"single","propMargin":"m25","instruments":["irspec","hires"],"duty":"d60","processing":"compress","antenna":"a03","radio":"r25","ground":"g1","coding":"robust","recorder":"rec64"}],
["storms","director","track","sso600|irspec+wide",{"orbit":"sso600","launcher":"light","route":"direct","lifetime":"y3","schedule":"plan","structure":"standard","panels":"p2","batteries":"b300","adcs":"magnet","computer":"single","propMargin":"m25","instruments":["irspec","wide"],"duty":"d60","processing":"compress","antenna":"a03","radio":"r5","ground":"g1","coding":"robust","recorder":"rec64"}],
["storms","engineer","early","geo|irspec+context",{"orbit":"geo","launcher":"light","route":"direct","lifetime":"y3","schedule":"plan","structure":"standard","panels":"p2","batteries":"b300","adcs":"magnet","computer":"single","propMargin":"m25","instruments":["irspec","context"],"duty":"d60","processing":"compress","antenna":"a03","radio":"r5","ground":"g1","coding":"robust","recorder":"rec64"}],
["storms","engineer","early","geo|irspec+hires",{"orbit":"geo","launcher":"light","route":"direct","lifetime":"y3","schedule":"plan","structure":"standard","panels":"p2","batteries":"b300","adcs":"magnet","computer":"single","propMargin":"m10","instruments":["irspec","hires"],"duty":"d60","processing":"compress","antenna":"a03","radio":"r5","ground":"g1","coding":"robust","recorder":"rec64"}],
["storms","engineer","early","polar800|irspec",{"orbit":"polar800","launcher":"light","route":"direct","lifetime":"y3","schedule":"plan","structure":"standard","panels":"p2","batteries":"b300","adcs":"wheels","computer":"single","propMargin":"m25","instruments":["irspec"],"duty":"d60","processing":"compress","antenna":"a03","radio":"r5","ground":"g1","coding":"robust","recorder":"rec64"}],
["storms","engineer","early","polar800|irspec+context",{"orbit":"polar800","launcher":"light","route":"direct","lifetime":"y3","schedule":"plan","structure":"standard","panels":"p2","batteries":"b300","adcs":"magnet","computer":"single","propMargin":"m25","instruments":["irspec","context"],"duty":"d60","processing":"compress","antenna":"a03","radio":"r5","ground":"g1","coding":"robust","recorder":"rec64"}],
["storms","engineer","track","geo|irspec+context",{"orbit":"geo","launcher":"light","route":"direct","lifetime":"y3","schedule":"plan","structure":"standard","panels":"p2","batteries":"b300","adcs":"magnet","computer":"single","propMargin":"m25","instruments":["irspec","context"],"duty":"d60","processing":"compress","antenna":"a03","radio":"r5","ground":"g1","coding":"robust","recorder":"rec64"}],
["storms","engineer","track","geo|irspec+wide",{"orbit":"geo","launcher":"light","route":"direct","lifetime":"y1","schedule":"plan","structure":"standard","panels":"p2","batteries":"b300","adcs":"magnet","computer":"single","propMargin":"m25","instruments":["irspec","wide"],"duty":"d60","processing":"compress","antenna":"a03","radio":"r5","ground":"g1","coding":"robust","recorder":"rec64"}],
["storms","engineer","track","polar800|irspec+context+hires",{"orbit":"polar800","launcher":"light","route":"direct","lifetime":"y3","schedule":"plan","structure":"standard","panels":"p2","batteries":"b300","adcs":"magnet","computer":"single","propMargin":"m25","instruments":["irspec","context","hires"],"duty":"d60","processing":"compress","antenna":"a03","radio":"r5","ground":"g2","coding":"robust","recorder":"rec64"}],
["storms","engineer","track","polar800|irspec+hires",{"orbit":"polar800","launcher":"light","route":"direct","lifetime":"y3","schedule":"plan","structure":"standard","panels":"p2","batteries":"b300","adcs":"magnet","computer":"single","propMargin":"m25","instruments":["irspec","hires"],"duty":"d60","processing":"compress","antenna":"a03","radio":"r5","ground":"g2","coding":"robust","recorder":"rec64"}],
["venus","cadet","chem","circ250|sar+irspec",{"orbit":"circ250","launcher":"medium","route":"capture","lifetime":"y2","schedule":"plan","ascent":"a150","rover":"none","structure":"standard","panels":"p4","batteries":"b2000","adcs":"wheels","computer":"single","propMargin":"m10","turrets":"t2","oxygen":"o1","instruments":["sar","irspec"],"duty":"d60","processing":"compress","weapons":["laser"],"drill":"hand","antenna":"a2","radio":"r50","ground":"g1","coding":"robust","recorder":"rec64","drones":"dr0","medkits":"mk2"}],
["venus","cadet","chem","circ250|sar+sounder+irspec",{"orbit":"circ250","launcher":"heavy","route":"capture","lifetime":"y2","schedule":"plan","ascent":"a150","rover":"none","structure":"standard","panels":"p4","batteries":"b2000","adcs":"wheels","computer":"single","propMargin":"m10","turrets":"t2","oxygen":"o1","instruments":["sar","sounder","irspec"],"duty":"d60","processing":"compress","weapons":["laser"],"drill":"hand","antenna":"a2","radio":"r50","ground":"g1","coding":"robust","recorder":"rec64","drones":"dr0","medkits":"mk2"}],
["venus","cadet","chem","ellipse|sar+irspec",{"orbit":"ellipse","launcher":"medium","route":"capture","lifetime":"y2","schedule":"plan","ascent":"a150","rover":"none","structure":"standard","panels":"p4","batteries":"b800","adcs":"wheels","computer":"single","propMargin":"m10","turrets":"t2","oxygen":"o1","instruments":["sar","irspec"],"duty":"d60","processing":"compress","weapons":["laser"],"drill":"hand","antenna":"a2","radio":"r25","ground":"g1","coding":"robust","recorder":"rec64","drones":"dr0","medkits":"mk2"}],
["venus","cadet","chem","ellipse|sar+sounder+irspec",{"orbit":"ellipse","launcher":"medium","route":"capture","lifetime":"y2","schedule":"plan","ascent":"a150","rover":"none","structure":"standard","panels":"p4","batteries":"b800","adcs":"wheels","computer":"single","propMargin":"m10","turrets":"t2","oxygen":"o1","instruments":["sar","sounder","irspec"],"duty":"d60","processing":"compress","weapons":["laser"],"drill":"hand","antenna":"a2","radio":"r25","ground":"g1","coding":"robust","recorder":"rec64","drones":"dr0","medkits":"mk2"}],
["venus","cadet","map","circ250|sar+irspec",{"orbit":"circ250","launcher":"medium","route":"capture","lifetime":"y2","schedule":"plan","ascent":"a150","rover":"none","structure":"standard","panels":"p4","batteries":"b800","adcs":"wheels","computer":"single","propMargin":"m10","turrets":"t2","oxygen":"o1","instruments":["sar","irspec"],"duty":"d60","processing":"compress","weapons":["laser"],"drill":"hand","antenna":"a2","radio":"r50","ground":"g1","coding":"robust","recorder":"rec64","drones":"dr0","medkits":"mk2"}],
["venus","cadet","map","circ250|sar+sounder+irspec",{"orbit":"circ250","launcher":"medium","route":"capture","lifetime":"y2","schedule":"plan","ascent":"a150","rover":"none","structure":"standard","panels":"p4","batteries":"b800","adcs":"wheels","computer":"single","propMargin":"m10","turrets":"t2","oxygen":"o1","instruments":["sar","sounder","irspec"],"duty":"d60","processing":"compress","weapons":["laser"],"drill":"hand","antenna":"a2","radio":"r50","ground":"g1","coding":"robust","recorder":"rec64","drones":"dr0","medkits":"mk2"}],
["venus","cadet","map","ellipse|sar+irspec",{"orbit":"ellipse","launcher":"medium","route":"capture","lifetime":"y2","schedule":"plan","ascent":"a150","rover":"none","structure":"standard","panels":"p4","batteries":"b800","adcs":"wheels","computer":"single","propMargin":"m10","turrets":"t2","oxygen":"o1","instruments":["sar","irspec"],"duty":"d60","processing":"compress","weapons":["laser"],"drill":"hand","antenna":"a2","radio":"r25","ground":"g1","coding":"robust","recorder":"rec64","drones":"dr0","medkits":"mk2"}],
["venus","cadet","map","ellipse|sar+sounder+irspec",{"orbit":"ellipse","launcher":"medium","route":"capture","lifetime":"y2","schedule":"plan","ascent":"a150","rover":"none","structure":"standard","panels":"p4","batteries":"b800","adcs":"wheels","computer":"single","propMargin":"m10","turrets":"t2","oxygen":"o1","instruments":["sar","sounder","irspec"],"duty":"d60","processing":"compress","weapons":["laser"],"drill":"hand","antenna":"a2","radio":"r25","ground":"g1","coding":"robust","recorder":"rec64","drones":"dr0","medkits":"mk2"}],
["venus","director","chem","ellipse|sar+irspec",{"orbit":"ellipse","launcher":"medium","route":"capture","lifetime":"y2","schedule":"plan","ascent":"a150","rover":"none","structure":"light","panels":"p4","batteries":"b800","adcs":"wheels","computer":"single","propMargin":"m10","turrets":"t2","oxygen":"o1","instruments":["sar","irspec"],"duty":"d60","processing":"compress","weapons":["laser"],"drill":"hand","antenna":"a2","radio":"r50","ground":"g1","coding":"robust","recorder":"rec64","drones":"dr0","medkits":"mk2"}],
["venus","director","chem","ellipse|sar+sounder+irspec",{"orbit":"ellipse","launcher":"medium","route":"capture","lifetime":"y2","schedule":"plan","ascent":"a150","rover":"none","structure":"light","panels":"p4","batteries":"b800","adcs":"wheels","computer":"single","propMargin":"m10","turrets":"t2","oxygen":"o1","instruments":["sar","sounder","irspec"],"duty":"d60","processing":"compress","weapons":["laser"],"drill":"hand","antenna":"a2","radio":"r50","ground":"g1","coding":"robust","recorder":"rec64","drones":"dr0","medkits":"mk2"}],
["venus","director","map","ellipse|sar+irspec",{"orbit":"ellipse","launcher":"medium","route":"capture","lifetime":"y2","schedule":"plan","ascent":"a150","rover":"none","structure":"light","panels":"p4","batteries":"b800","adcs":"wheels","computer":"single","propMargin":"m10","turrets":"t2","oxygen":"o1","instruments":["sar","irspec"],"duty":"d60","processing":"compress","weapons":["laser"],"drill":"hand","antenna":"a2","radio":"r50","ground":"g1","coding":"robust","recorder":"rec64","drones":"dr0","medkits":"mk2"}],
["venus","director","map","ellipse|sar+sounder+irspec",{"orbit":"ellipse","launcher":"medium","route":"capture","lifetime":"y2","schedule":"plan","ascent":"a150","rover":"none","structure":"light","panels":"p4","batteries":"b800","adcs":"wheels","computer":"single","propMargin":"m10","turrets":"t2","oxygen":"o1","instruments":["sar","sounder","irspec"],"duty":"d60","processing":"compress","weapons":["laser"],"drill":"hand","antenna":"a2","radio":"r50","ground":"g1","coding":"robust","recorder":"rec64","drones":"dr0","medkits":"mk2"}],
["venus","engineer","chem","circ250|sar+irspec+uso",{"orbit":"circ250","launcher":"medium","route":"capture","lifetime":"y3","schedule":"plan","ascent":"a150","rover":"none","structure":"light","panels":"p4","batteries":"b800","adcs":"magnet","computer":"single","propMargin":"m10","turrets":"t2","oxygen":"o1","instruments":["sar","irspec","uso"],"duty":"d30","processing":"smart","weapons":["laser"],"drill":"hand","antenna":"a1","radio":"r25","ground":"g1","coding":"fast","recorder":"rec64","drones":"dr0","medkits":"mk2"}],
["venus","engineer","chem","ellipse|sar+irspec",{"orbit":"ellipse","launcher":"medium","route":"capture","lifetime":"y2","schedule":"plan","ascent":"a150","rover":"none","structure":"light","panels":"p4","batteries":"b800","adcs":"magnet","computer":"single","propMargin":"m10","turrets":"t2","oxygen":"o1","instruments":["sar","irspec"],"duty":"d60","processing":"compress","weapons":["laser"],"drill":"hand","antenna":"a2","radio":"r50","ground":"g1","coding":"robust","recorder":"rec64","drones":"dr0","medkits":"mk2"}],
["venus","engineer","chem","ellipse|sar+irspec+uso",{"orbit":"ellipse","launcher":"medium","route":"capture","lifetime":"y2","schedule":"plan","ascent":"a150","rover":"none","structure":"light","panels":"p4","batteries":"b800","adcs":"magnet","computer":"single","propMargin":"m10","turrets":"t2","oxygen":"o1","instruments":["sar","irspec","uso"],"duty":"d60","processing":"compress","weapons":["laser"],"drill":"hand","antenna":"a2","radio":"r50","ground":"g1","coding":"robust","recorder":"rec64","drones":"dr0","medkits":"mk2"}],
["venus","engineer","map","circ250|sar+irspec",{"orbit":"circ250","launcher":"medium","route":"capture","lifetime":"y2","schedule":"plan","ascent":"a150","rover":"none","structure":"light","panels":"p4","batteries":"b800","adcs":"magnet","computer":"single","propMargin":"m10","turrets":"t2","oxygen":"o1","instruments":["sar","irspec"],"duty":"d90","processing":"smart","weapons":["laser"],"drill":"hand","antenna":"a2","radio":"r50","ground":"g1","coding":"fast","recorder":"rec64","drones":"dr0","medkits":"mk2"}],
["venus","engineer","map","ellipse|sar+irspec",{"orbit":"ellipse","launcher":"medium","route":"capture","lifetime":"y2","schedule":"plan","ascent":"a150","rover":"none","structure":"light","panels":"p4","batteries":"b800","adcs":"magnet","computer":"single","propMargin":"m10","turrets":"t2","oxygen":"o1","instruments":["sar","irspec"],"duty":"d60","processing":"compress","weapons":["laser"],"drill":"hand","antenna":"a2","radio":"r50","ground":"g1","coding":"robust","recorder":"rec64","drones":"dr0","medkits":"mk2"}],
["venus","engineer","map","ellipse|sar+irspec+uso",{"orbit":"ellipse","launcher":"medium","route":"capture","lifetime":"y2","schedule":"plan","ascent":"a150","rover":"none","structure":"light","panels":"p4","batteries":"b800","adcs":"magnet","computer":"single","propMargin":"m10","turrets":"t2","oxygen":"o1","instruments":["sar","irspec","uso"],"duty":"d60","processing":"compress","weapons":["laser"],"drill":"hand","antenna":"a2","radio":"r50","ground":"g1","coding":"robust","recorder":"rec64","drones":"dr0","medkits":"mk2"}],
["cubesat","cadet","green","iss|cubeCam",{"orbit":"iss","launcher":"slot6","route":"rideshare","lifetime":"y1","schedule":"plan","structure":"standard","panels":"wings2","batteries":"b20","adcs":"wheels","computer":"dual","propMargin":"mnone","thermal":"standard","instruments":["cubeCam"],"duty":"d60","processing":"compress","antenna":"patch","radio":"xband","ground":"gu2","coding":"robust","recorder":"rec32"}],
["cubesat","cadet","green","iss|cubeCam+cubeTir",{"orbit":"iss","launcher":"slot12","route":"rideshare","lifetime":"y1","schedule":"plan","structure":"standard","panels":"wings2","batteries":"b20","adcs":"wheels","computer":"single","propMargin":"mnone","thermal":"standard","instruments":["cubeCam","cubeTir"],"duty":"d60","processing":"compress","antenna":"whip","radio":"sband","ground":"gu2","coding":"robust","recorder":"rec8"}],
["cubesat","cadet","green","iss|cubeCam+cubeWide",{"orbit":"iss","launcher":"slot6","route":"rideshare","lifetime":"y1","schedule":"plan","structure":"standard","panels":"wings2","batteries":"b20","adcs":"wheels","computer":"single","propMargin":"mnone","thermal":"standard","instruments":["cubeCam","cubeWide"],"duty":"d60","processing":"compress","antenna":"patch","radio":"xband","ground":"gu2","coding":"robust","recorder":"rec8"}],
["cubesat","cadet","thirst","iss|cubeCam+cubeTir+cubeWide",{"orbit":"iss","launcher":"slot12","route":"rideshare","lifetime":"y1","schedule":"plan","structure":"standard","panels":"wings2","batteries":"b20","adcs":"wheels","computer":"single","propMargin":"mnone","thermal":"standard","instruments":["cubeCam","cubeTir","cubeWide"],"duty":"d60","processing":"compress","antenna":"whip","radio":"sband","ground":"gu2","coding":"robust","recorder":"rec8"}],
["cubesat","cadet","thirst","sso525|cubeCam+cubeTir",{"orbit":"sso525","launcher":"slot12","route":"rideshare","lifetime":"y2","schedule":"plan","structure":"standard","panels":"body","batteries":"b40","adcs":"wheels","computer":"single","propMargin":"mnone","thermal":"standard","instruments":["cubeCam","cubeTir"],"duty":"d30","processing":"compress","antenna":"whip","radio":"sband","ground":"gu2","coding":"robust","recorder":"rec32"}],
["cubesat","cadet","thirst","sso525|cubeTir+cubeWide",{"orbit":"sso525","launcher":"slot6","route":"rideshare","lifetime":"y2","schedule":"plan","structure":"standard","panels":"wings2","batteries":"b20","adcs":"wheels","computer":"single","propMargin":"mnone","thermal":"standard","instruments":["cubeTir","cubeWide"],"duty":"d60","processing":"raw","antenna":"whip","radio":"sband","ground":"gu2","coding":"robust","recorder":"rec32"}],
["cubesat","engineer","green","iss|cubeCam",{"orbit":"iss","launcher":"slot6","route":"rideshare","lifetime":"y1","schedule":"plan","structure":"standard","panels":"body","batteries":"b20","adcs":"wheels","computer":"dual","propMargin":"mnone","thermal":"standard","instruments":["cubeCam"],"duty":"d60","processing":"raw","antenna":"whip","radio":"xband","ground":"gu2","coding":"robust","recorder":"rec32"}],
["cubesat","engineer","green","iss|cubeCam+cubeTir",{"orbit":"iss","launcher":"slot6","route":"rideshare","lifetime":"y1","schedule":"plan","structure":"standard","panels":"wings2","batteries":"b10","adcs":"magnet","computer":"single","propMargin":"mnone","thermal":"blanket","instruments":["cubeCam","cubeTir"],"duty":"d60","processing":"compress","antenna":"whip","radio":"sband","ground":"gu2","coding":"robust","recorder":"rec8"}],
["cubesat","engineer","green","iss|cubeCam+cubeWide",{"orbit":"iss","launcher":"slot6","route":"rideshare","lifetime":"y1","schedule":"plan","structure":"standard","panels":"wings2","batteries":"b10","adcs":"wheels","computer":"single","propMargin":"mnone","thermal":"standard","instruments":["cubeCam","cubeWide"],"duty":"d60","processing":"compress","antenna":"whip","radio":"sband","ground":"gu2","coding":"robust","recorder":"rec8"}],
["cubesat","engineer","thirst","iss|cubeHyper",{"orbit":"iss","launcher":"slot6","route":"rideshare","lifetime":"y1","schedule":"plan","structure":"standard","panels":"body","batteries":"b10","adcs":"wheels","computer":"single","propMargin":"mnone","thermal":"blanket","instruments":["cubeHyper"],"duty":"d30","processing":"smart","antenna":"whip","radio":"sband","ground":"gu2","coding":"robust","recorder":"rec8"}],
["cubesat","engineer","thirst","iss|cubeCam+cubeHyper",{"orbit":"iss","launcher":"slot6","route":"rideshare","lifetime":"m6","schedule":"plan","structure":"standard","panels":"wings2","batteries":"b10","adcs":"magnet","computer":"single","propMargin":"mnone","thermal":"blanket","instruments":["cubeCam","cubeHyper"],"duty":"d60","processing":"compress","antenna":"whip","radio":"xband","ground":"gu2","coding":"robust","recorder":"rec8"}],
["cubesat","engineer","thirst","iss|cubeTir+cubeHyper",{"orbit":"iss","launcher":"slot6","route":"rideshare","lifetime":"y1","schedule":"plan","structure":"standard","panels":"body","batteries":"b20","adcs":"magnet","computer":"single","propMargin":"mnone","thermal":"blanket","instruments":["cubeTir","cubeHyper"],"duty":"d30","processing":"smart","antenna":"whip","radio":"sband","ground":"gu2","coding":"fast","recorder":"rec8"}],
["cubesat","director","green","iss|cubeHyper",{"orbit":"iss","launcher":"slot6","route":"rideshare","lifetime":"y1","schedule":"plan","structure":"standard","panels":"wings2","batteries":"b10","adcs":"magnet","computer":"single","propMargin":"mnone","thermal":"blanket","instruments":["cubeHyper"],"duty":"d60","processing":"smart","antenna":"whip","radio":"sband","ground":"gu2","coding":"robust","recorder":"rec8"}],
["cubesat","director","green","iss|cubeWide+cubeHyper",{"orbit":"iss","launcher":"slot6","route":"rideshare","lifetime":"y1","schedule":"plan","structure":"standard","panels":"wings2","batteries":"b10","adcs":"magnet","computer":"single","propMargin":"mnone","thermal":"blanket","instruments":["cubeWide","cubeHyper"],"duty":"d60","processing":"smart","antenna":"whip","radio":"sband","ground":"gu2","coding":"robust","recorder":"rec8"}],
["cubesat","director","green","sso525|cubeCam+cubeTir",{"orbit":"sso525","launcher":"slot6","route":"rideshare","lifetime":"y2","schedule":"plan","structure":"standard","panels":"wings2","batteries":"b20","adcs":"magnet","computer":"single","propMargin":"mnone","thermal":"blanket","instruments":["cubeCam","cubeTir"],"duty":"d60","processing":"compress","antenna":"whip","radio":"sband","ground":"gu2","coding":"robust","recorder":"rec8"}],
["cubesat","director","thirst","iss|cubeHyper",{"orbit":"iss","launcher":"slot6","route":"rideshare","lifetime":"y1","schedule":"plan","structure":"standard","panels":"wings2","batteries":"b10","adcs":"magnet","computer":"single","propMargin":"mnone","thermal":"blanket","instruments":["cubeHyper"],"duty":"d60","processing":"smart","antenna":"whip","radio":"sband","ground":"gu2","coding":"robust","recorder":"rec8"}],
["cubesat","director","thirst","iss|cubeWide+cubeHyper",{"orbit":"iss","launcher":"slot6","route":"rideshare","lifetime":"y1","schedule":"plan","structure":"standard","panels":"wings2","batteries":"b10","adcs":"magnet","computer":"single","propMargin":"mnone","thermal":"blanket","instruments":["cubeWide","cubeHyper"],"duty":"d60","processing":"smart","antenna":"whip","radio":"sband","ground":"gu2","coding":"robust","recorder":"rec8"}],
["cubesat","director","thirst","sso525|cubeCam+cubeTir",{"orbit":"sso525","launcher":"slot6","route":"rideshare","lifetime":"y2","schedule":"plan","structure":"standard","panels":"wings2","batteries":"b20","adcs":"magnet","computer":"single","propMargin":"mnone","thermal":"blanket","instruments":["cubeCam","cubeTir"],"duty":"d60","processing":"smart","antenna":"whip","radio":"sband","ground":"gu1","coding":"robust","recorder":"rec8"}]
];

const asDesign = (w) => ({ v: 1, scenario: w[0], difficulty: w[1], requirement: w[2], picks: w[4] });
const allFixed = (d, seed) => Object.fromEntries(sim.crisesFor(d, seed).map((c) => [c.id, c.kind === 'opportunity' ? 'taken' : 'fixed']));
const rnd = (a) => () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

test('catalog has the four roles, landing gear only on landing missions, and no combat gear', () => {
  for (const s of sim.scenarios()) {
    const cat = sim.catalog(s.id, 'engineer');
    assert.deepEqual(Object.keys(cat.roles), ['planner', 'engineer', 'scientist', 'comms']);
    const keys = Object.values(cat.roles).flat().map((g) => g.key);
    for (const k of ['orbit', 'launcher', 'panels', 'batteries', 'instruments', 'antenna', 'radio', 'recorder', 'ground']) assert.ok(keys.includes(k), `${s.id} has ${k}`);
    assert.equal(keys.includes('ascent'), s.landing, `${s.id} surface parts match landing`);
    for (const k of ['weapons', 'turrets', 'drones', 'medkits', 'rover']) assert.ok(!keys.includes(k), `${s.id} has no ${k}`);
    if (!s.landing) assert.equal(s.training, true);
    for (const g of Object.values(cat.roles).flat()) for (const o of g.options) assert.ok(o.id && o.name, `${g.key} option named`);
  }
});

test('decision counts are roughly equal across roles', () => {
  for (const s of sim.scenarios()) {
    const counts = Object.values(sim.catalog(s.id, 'engineer').roles).map((gs) => gs.reduce((n, g) => n + (g.multi ? 2 : 1), 0));
    assert.ok(Math.max(...counts) - Math.min(...counts) <= 4, `${s.id}: ${counts}`);
  }
});

test('newDesign is launchable and role permissions are enforced', () => {
  for (const s of sim.scenarios()) for (const dd of ['cadet', 'engineer', 'director', 'sandbox']) {
    const d = sim.newDesign(s.id, dd, s.requirements[0].id);
    assert.ok(sim.checks(d).find((c) => c.id === 'launcher').ok, `${s.id}/${dd} starter launches`);
    assert.ok(sim.set(d, 'scientist', 'antenna', 'a2').error);
    assert.deepEqual(sim.rolesOf('antenna'), ['comms']);
  }
  const d = sim.newDesign('mars', 'engineer', 'ice');
  const next = sim.set(d, 'comms', 'antenna', 'a3');
  assert.equal(next.picks.antenna, 'a3');
  assert.notEqual(d.picks.antenna, 'a3', 'set returns a new design');
  const toggled = sim.set(d, 'scientist', 'instruments', 'sounder');
  assert.ok(toggled.picks.instruments.includes('sounder') !== d.picks.instruments.includes('sounder'));
});

test('hard launcher check blocks a stack the rocket cannot lift', () => {
  // Europa on a light rocket: far beyond what it can throw toward Jupiter.
  const heavy = sim.set(sim.newDesign('europa', 'engineer', 'shell'), 'planner', 'launcher', 'light');
  const c = sim.checks(heavy).find((x) => x.id === 'launcher');
  assert.equal(c.ok, false);
  assert.equal(c.hard, true);
  assert.match(c.text, /kg/);
  assert.equal(sim.fly(heavy, 5).result.alive, false, 'a blocked stack cannot fly');
});

test('capacity depends on the orbit', () => {
  const cat = sim.catalog('storms', 'engineer');
  const launcher = cat.roles.planner.find((g) => g.key === 'launcher').options[0];
  assert.ok(launcher.capacityByOrbit.polar800 > launcher.capacityByOrbit.geo, 'a geostationary orbit is much harder to reach');
});

test('resources have status and the right shape', () => {
  const d = sim.newDesign('moon', 'engineer', 'map');
  const r = sim.resources(d);
  for (const k of ['mass', 'power', 'budget', 'data', 'comms', 'time']) {
    for (const f of ['value', 'limit', 'unit', 'status', 'why']) assert.ok(f in r[k], `${k}.${f}`);
    assert.ok(['ok', 'warn', 'bad'].includes(r[k].status));
  }
  const p = sim.preview(d, 'comms', 'antenna', 'a3');
  assert.ok(p.mass && p.mass.delta > 0, 'a bigger dish adds mass');
});

test('fly is deterministic and frames show the mission', () => {
  const d = sim.newDesign('mars', 'engineer', 'ice');
  const a = sim.fly(d, 42);
  const b = sim.fly(d, 42);
  assert.deepEqual(a, b);
  assert.ok(a.frames.length >= 400, 'about 70 seconds of frames');
  const f = a.frames[100];
  for (const k of ['t', 'sunlit', 'battery', 'powerIn', 'powerOut', 'buffer', 'downlink', 'science', 'fuel', 'alive', 'phase']) assert.ok(k in f, k);
  assert.notDeepEqual(sim.fly(d, 43).events, a.events, 'seed changes the flight');
  assert.ok(a.frames.some((x) => !x.sunlit), 'eclipses are visible');
  assert.ok(a.frames.some((x) => x.inPass) && a.frames.some((x) => x.phase === 'ops' && !x.inPass), 'downlink gaps are visible');
});

test('crises have a different alarm and fix role, and outcomes change the flight only afterwards', () => {
  const d = sim.newDesign('moon', 'director', 'map');
  const crises = sim.crisesFor(d, 9);
  assert.ok(crises.length >= 4);
  crises.forEach((c) => {
    assert.notEqual(c.role, c.fixRole, `${c.id}: alarm and fix are on different phones`);
    assert.ok(c.actions.some((a) => a.correct));
  });
  const missed = sim.fly(d, 9, {});
  const fixed = sim.fly(d, 9, allFixed(d, 9));
  assert.notDeepEqual(missed.result, fixed.result, 'crisis outcomes change the flight');
  const first = Math.min(...crises.map((c) => c.t));
  const idx = missed.frames.findIndex((f) => f.t >= first) - 1;
  assert.deepEqual(missed.frames.slice(0, idx), fixed.frames.slice(0, idx), 'frames before the first crisis are identical');
  assert.ok(fixed.result.science >= missed.result.science);
});

test('every scenario is winnable at every difficulty (3 seeds, crises fixed)', () => {
  const seen = new Set();
  for (const w of WINNERS) {
    const d = asDesign(w);
    seen.add(`${w[0]}/${w[1]}/${w[2]}`);
    assert.ok(sim.checks(d).find((c) => c.id === 'launcher').ok, `${w[3]} launches`);
    assert.ok(sim.checks(d).find((c) => c.id === 'budget').ok, `${w[3]} is under budget`);
    for (const seed of [11, 222, 3333]) {
      const r = sim.fly(d, seed, allFixed(d, seed)).result;
      assert.equal(r.success, 'full', `${w[0]}/${w[1]}/${w[2]} ${w[3]} seed ${seed}: ${r.success} ${r.science}% ${r.cause}`);
    }
  }
  for (const s of sim.scenarios()) for (const r of s.requirements) for (const df of ['cadet', 'engineer', 'director']) assert.ok(seen.has(`${s.id}/${df}/${r.id}`), `${s.id}/${df}/${r.id} has a winner`);
});

test('no dominant strategy: several winning archetypes, and maxing everything does not fit', () => {
  for (const s of sim.scenarios()) for (const df of ['cadet', 'engineer', 'director']) {
    const list = WINNERS.filter((w) => w[0] === s.id && w[1] === df);
    assert.ok(new Set(list.map((w) => w[3])).size >= 2, `${s.id}/${df}: ${list.map((w) => w[3])}`);
  }
  const instSets = new Set(WINNERS.map((w) => w[3].split('|')[1]));
  assert.ok(instSets.size > 8, 'many different instrument sets win');
  for (const s of sim.scenarios()) {
    const cat = sim.catalog(s.id, 'engineer');
    let d = sim.newDesign(s.id, 'engineer', s.requirements[0].id);
    const score = (o) => (o.mass || 0) + 3 * (o.costM !== undefined ? o.costM : o.cost || 0);
    for (const [role, groups] of Object.entries(cat.roles)) for (const g of groups) {
      const sorted = g.options.slice().sort((a, b) => score(b) - score(a));
      const n = sim.set(d, role, g.key, g.multi ? sorted.slice(0, g.max).map((o) => o.id) : sorted[0].id);
      if (!n.error) d = n;
    }
    const c = sim.checks(d);
    assert.ok(!c.find((x) => x.id === 'launcher').ok || !c.find((x) => x.id === 'budget').ok, `${s.id}: maxing everything must not fit`);
  }
});

test('every resource can be the tight one in some scenario', () => {
  const peak = { mass: 0, power: 0, budget: 0, data: 0, comms: 0, time: 0 };
  const grouped = {};
  for (const w of WINNERS) (grouped[`${w[0]}/${w[1]}`] = grouped[`${w[0]}/${w[1]}`] || []).push(asDesign(w));
  for (const list of Object.values(grouped)) {
    const sum = { mass: 0, power: 0, budget: 0, data: 0, comms: 0, time: 0 };
    for (const d of list) {
      const r = sim.resources(d);
      sum.mass += r.mass.value / r.mass.limit;
      sum.power += r.power.limit / Math.max(1, r.power.value);
      sum.budget += r.budget.limit ? r.budget.value / r.budget.limit : 0;
      sum.data += r.data.value / r.data.limit;
      sum.comms += r.comms.limit / Math.max(0.001, r.comms.value);
      sum.time += r.time.limit ? r.time.value / r.time.limit : 0;
    }
    for (const k of Object.keys(peak)) peak[k] = Math.max(peak[k], sum[k] / list.length);
  }
  for (const [k, v] of Object.entries(peak)) assert.ok(v >= 0.8, `${k} peak tightness ${v.toFixed(2)}`);
});

test('beginners succeed in part on the first try and improve on the second', () => {
  const beginner = (sc, df, req, r) => {
    let d = sim.newDesign(sc, df, req);
    const cat = sim.catalog(sc, df);
    const inst = cat.roles.scientist.find((g) => g.key === 'instruments');
    const picks = inst.options.filter((o) => o.scienceFor[req] > 0).sort((a, b) => b.scienceFor[req] - a.scienceFor[req]).slice(0, 2).map((o) => o.id);
    const n = sim.set(d, 'scientist', 'instruments', picks);
    if (!n.error) d = n;
    for (let i = 0; i < 12; i++) {
      const res = sim.resources(d);
      const bad = Object.keys(res).filter((k) => res[k].status !== 'ok');
      if (!bad.length) break;
      let done = false;
      for (const k of bad) {
        const opts = [];
        for (const [role, groups] of Object.entries(cat.roles)) for (const g of groups) {
          if (g.multi) continue;
          for (const o of g.options) {
            if (o.id === d.picks[g.key]) continue;
            const pv = sim.preview(d, role, g.key, o.id);
            if (pv.error) continue;
            if (k === 'power' || k === 'comms' ? pv[k].delta > 0 : pv[k].delta < 0) opts.push({ role, key: g.key, id: o.id, d: Math.abs(pv[k].delta) });
          }
        }
        if (opts.length) {
          opts.sort((a, b) => b.d - a.d);
          const c = opts[Math.floor(r() * Math.min(3, opts.length))];
          const m = sim.set(d, c.role, c.key, c.id);
          if (!m.error) { d = m; done = true; break; }
        }
      }
      if (!done) break;
    }
    return d;
  };
  const half = (d, seed) => Object.fromEntries(sim.crisesFor(d, seed).map((c, i) => [c.id, i % 2 ? (c.kind === 'opportunity' ? 'skipped' : 'missed') : c.kind === 'opportunity' ? 'taken' : 'fixed']));
  let partial = 0, improved = 0, n = 0;
  for (const s of sim.scenarios()) {
    const r = rnd(5);
    for (let i = 0; i < 2; i++) {
      const d = beginner(s.id, 'cadet', s.requirements[0].id, r);
      const seed = 1000 + i;
      const f = sim.fly(d, seed, half(d, seed));
      if (f.result.success !== 'fail') partial++;
      const b = sim.bestChange(d, seed, half(d, seed));
      const d2 = b ? b.design : d;
      if (sim.score(d2, sim.fly(d2, seed, half(d2, seed))).total >= sim.score(d, f).total) improved++;
      n++;
    }
  }
  assert.ok(partial / n >= 0.75, `beginners partly succeed: ${partial}/${n}`);
  assert.ok(improved / n >= 0.9, `second try improves: ${improved}/${n}`);
});

test('chain is cause-to-effect, reproducible and built on real re-simulation', () => {
  let d = sim.newDesign('mars', 'engineer', 'ice');
  for (const [r, k, v] of [['scientist', 'instruments', ['iceRadar', 'hires']], ['scientist', 'duty', 'd90'], ['comms', 'recorder', 'rec64'], ['comms', 'antenna', 'a1'], ['comms', 'radio', 'r25']]) {
    d = sim.set(d, r, k, v);
    assert.ok(!d.error);
  }
  const a = sim.chain(d, 7);
  assert.deepEqual(a, sim.chain(d, 7), 'same design and seed give the same chain');
  assert.ok(a.length >= 3);
  a.forEach((s) => { assert.ok(s.text && s.why && s.kind, 'each step has text, why, kind'); assert.ok('delta' in s); });
  assert.equal(a[0].kind, 'decision', 'chain starts at a decision');
  assert.equal(a[a.length - 1].kind, 'revert', 'chain ends with what the re-flown change achieved');
  assert.ok(a.some((s) => /Gbit|%/.test(s.text)), 'chain has concrete numbers');
  const best = sim.bestChange(d, 7);
  assert.ok(best && best.gain > 0, 'a single change helps');
  assert.ok(best.design.picks[best.key] === best.to || Array.isArray(best.design.picks[best.key]));
});

test('surfaceLoadout matches the TEAM-SURFACE contract and drives the surface sim', () => {
  const Surface = require('../js/team/surface-sim.js');
  assert.equal(sim.surfaceLoadout(sim.newDesign('nile', 'engineer', 'sharp')), null, 'Earth flights have no surface');
  for (const id of ['moon', 'mars', 'venus', 'europa']) {
    const s = sim.scenarios().find((x) => x.id === id);
    const d = sim.newDesign(id, 'engineer', s.requirements[0].id);
    const l = sim.surfaceLoadout(d);
    assert.ok(['moon', 'mars', 'venus', 'europa'].includes(l.world));
    for (const f of ['objective', 'weapons', 'power', 'instruments', 'recorderGbit', 'uplink', 'landing', 'lifetimeS', 'ascent', 'parts']) assert.ok(f in l, f);
    assert.ok(l.lifetimeS >= 150 && l.lifetimeS <= 360);
    assert.ok(l.uplink.rateGbitS > 0 && l.uplink.everyS > 0 && l.uplink.windowS > 0);
    const state = Surface.create(l, 1, [], { hazards: 'realistic', difficulty: 'engineer', world: l.world });
    for (let i = 0; i < 30; i++) Surface.step(state, {}, 1 / 30);
    const summary = Surface.summary(state);
    assert.equal(typeof summary.crewTotal, 'number');
    const chain = sim.chain(d, 3, summary);
    assert.ok(Array.isArray(chain) && chain.length > 0);
    assert.ok(sim.score(d, sim.fly(d, 3), {}, summary).total >= 0);
  }
  assert.equal(sim.surfaceLoadout(sim.newDesign('venus', 'engineer', 'map')).platform, 'floating', 'Venus floats');
});

test('surface parts cost mass and money, and more ascent fuel lifts more', () => {
  const d = sim.newDesign('mars', 'engineer', 'ice');
  const before = sim.resources(d);
  const n1 = sim.set(d, 'engineer', 'oxygen', 'o2');
  const after = sim.resources(n1);
  assert.ok(after.mass.value > before.mass.value, 'spare oxygen adds mass');
  assert.ok(after.budget.value > before.budget.value, 'spare oxygen adds cost');
  const L = sim.surfaceLoadout(d);
  assert.deepEqual([L.turrets, L.rover, L.drones, L.medkits], [0, false, 0, 0], 'no combat gear on the surface');
  assert.ok(L.weapons.every((w) => w === 'drill'), 'only the drill goes down');
  const light = sim.set(d, 'planner', 'ascent', 'a60');
  const heavy = sim.set(d, 'planner', 'ascent', 'a600');
  assert.ok(sim.surfaceLoadout(heavy).ascent.liftKg > sim.surfaceLoadout(light).ascent.liftKg);
  const moon = sim.set(sim.newDesign('moon', 'engineer', 'map'), 'planner', 'ascent', 'a150');
  const mars = sim.set(d, 'planner', 'ascent', 'a150');
  assert.ok(sim.surfaceLoadout(moon).ascent.liftKg > sim.surfaceLoadout(mars).ascent.liftKg, 'Moon ascent lifts more than Mars for the same fuel');
});

test('chain, score and obituary run through surface causes', () => {
  const d = sim.newDesign('mars', 'engineer', 'ice');
  const f = sim.fly(d, 3);
  const facts = [{ id: 'dish_overrun', kind: 'bad', part: 'radio', text: 'Dish overrun in 2 windows.', why: 'Too slow.', value: 2 }];
  const ss = { outcome: 'wiped', crewTotal: 4, survivors: 0, scienceFrac: 0.2, setsLost: 2, overrunWave: 2, cause: 'crew_lost', baseDark: false, samplesKg: 0, samplesLeftKg: 0, liftKg: 40, facts };
  const chain = sim.chain(d, 3, ss);
  assert.ok(chain.some((s) => s.kind === 'surface' && /Dish overrun/.test(s.text)));
  const scored = sim.score(d, f, {}, ss);
  assert.strictEqual(scored.outcome.id, 'lost', 'a lost crew is a lost mission');
  assert.ok(scored.total <= 299, 'a lost crew can never score like a success');
  const ob = sim.obituary(d, f, ss);
  assert.ok(ob && ob.crew && ob.epitaph);
  assert.ok(/^https?:/.test(ob.analog.source));
});

test('obituary names a real mission with a source for every cause', () => {
  const lists = { ...data.ANALOGS, ...data.SURFACE_ANALOGS };
  for (const [k, a] of Object.entries(lists)) {
    assert.ok(a.mission && a.year && a.story && /^https:/.test(a.source), k);
    assert.ok(data.EPITAPHS[k] && data.EPITAPHS[k].length, `${k} has an epitaph`);
  }
  // A dead mission gets an obituary, a healthy one does not.
  const d = sim.newDesign('moon', 'cadet', 'map');
  assert.ok(sim.obituary(d, { result: { cause: 'power', alive: false, lifeDays: 40 } }));
  assert.equal(sim.obituary(d, { result: { cause: null, alive: true, lifeDays: 400 } }), null);
});

test('score adds four traceable axes and the outcome rule, out of 1000, with medals', () => {
  for (const w of WINNERS.slice(0, 6)) {
    const d = asDesign(w);
    const f = sim.fly(d, 11, allFixed(d, 11));
    const s = sim.score(d, f, { requestsSent: 4, requestsAnswered: 3, agendas: sim.agendas(11) });
    assert.equal(s.total, s.requirements + s.science + s.efficiency + s.teamwork + s.outcome.adjust);
    assert.ok(s.total <= 1000 && s.requirements <= 300 && s.science <= 300 && s.efficiency <= 200 && s.teamwork <= 200);
    for (const [id, ax] of Object.entries(s.axes)) assert.equal(ax.value, ax.items.reduce((n, x) => n + x.points, 0), id + ' items add up');
    assert.ok(s.total >= s.outcome.band[0] && s.total <= s.outcome.band[1]);
    assert.ok(['gold', 'silver', 'bronze', 'none'].includes(s.medal));
  }
});

test('agendas conflict: one per role, satisfying all four at once is rare', () => {
  const list = sim.agendas(5);
  assert.equal(list.length, 4);
  assert.equal(new Set(list.map((a) => a.role)).size, 4);
  list.forEach((a) => assert.ok(a.conflictsWith));
  const ids = ['many_instruments', 'power_margin', 'two_stations', 'under_budget'];
  let all = 0;
  for (const w of WINNERS) {
    const d = asDesign(w);
    const f = sim.fly(d, 11, allFixed(d, 11));
    if (ids.every((id) => sim.agendaMet({ id }, d, f))) all++;
  }
  assert.ok(all / WINNERS.length < 0.2, `all four met together by ${all}/${WINNERS.length} winners`);
});

test('encode and decode round trip URL-safe', () => {
  const d = sim.newDesign('europa', 'director', 'ocean');
  const s = sim.encode({ design: d, score: 777 });
  assert.match(s, /^[A-Za-z0-9_-]+$/);
  assert.deepEqual(sim.decode(s), { design: d, score: 777 });
  assert.equal(sim.decode('@@not-json@@'), null);
});

test('toCraftDesign gives buildCraft what it needs', () => {
  const d = sim.newDesign('venus', 'engineer', 'map');
  const c = sim.toCraftDesign(d);
  assert.ok(Array.isArray(c.instruments));
  for (const f of ['arrays', 'dish', 'amp', 'recorder', 'shield']) assert.ok(typeof c[f] === 'number', f);
  assert.ok(c.info.dryKg > 0 && c.info.propKg > 0);
});

test('every string has an Arabic translation', () => {
  const ar = globalThis.SMD.i18nDicts.ar;
  const missing = data.strings().filter((x) => !ar[x.key]).map((x) => x.key);
  assert.deepEqual(missing, []);
});


// ---------- The build, one component per step (TEAM-V2) ----------
test('build steps: fixed order, at most three choices, Cadet skips the advanced ones', () => {
  const ORDER = ['orbit', 'route', 'power', 'batteries', 'thermal', 'instruments', 'radio', 'ground', 'recorder', 'computer', 'lifetime', 'landing', 'rocket'];
  for (const s of sim.scenarios()) {
    for (const df of ['cadet', 'engineer', 'director']) {
      const steps = sim.buildSteps(s.id, df);
      const ids = steps.map((x) => x.id);
      assert.deepEqual(ids, ORDER.filter((x) => ids.includes(x)), `${s.id}/${df} order`);
      assert.equal(ids.includes('landing'), s.landing, `${s.id} landing kit only where you land`);
      assert.equal(ids[ids.length - 1], 'rocket', 'the rocket comes last, once you know the mass');
      for (const st of steps) {
        assert.ok(st.options.length >= 1 && st.options.length <= 3, `${s.id}/${df}/${st.id}: ${st.options.length} options`);
        assert.ok(st.title && st.ask && ['planner', 'engineer', 'scientist', 'comms'].includes(st.role));
      }
    }
    const cadet = sim.buildSteps(s.id, 'cadet').length;
    const director = sim.buildSteps(s.id, 'director').length;
    assert.ok(cadet < director, `${s.id}: cadet ${cadet} < director ${director}`);
  }
});

test('build steps: every job owns at least one step, and the starter is one of the cards', () => {
  for (const s of sim.scenarios()) {
    for (const df of ['cadet', 'engineer', 'director']) {
      const d = sim.newDesign(s.id, df, s.requirements[0].id);
      const steps = sim.buildSteps(s.id, df);
      for (const r of ['planner', 'engineer', 'scientist', 'comms']) assert.ok(steps.some((st) => st.role === r), `${s.id}/${df}: ${r} owns a step`);
      for (const st of steps) {
        const now = sim.stepChoice(d, st);
        if (st.multi) assert.ok(now.length >= 1, `${st.id}: an instrument is fitted`);
        else assert.ok(now, `${s.id}/${df}/${st.id}: the starter shows as a card`);
      }
    }
  }
});

test('applyStep fits a whole card, instruments toggle, and nothing else changes', () => {
  const d = sim.newDesign('mars', 'engineer', 'ice');
  const radio = sim.applyStep(d, 'radio', 'big');
  assert.equal(radio.picks.antenna, 'a3');
  assert.equal(radio.picks.radio, 'r100');
  for (const k of Object.keys(d.picks)) if (k !== 'antenna' && k !== 'radio') assert.deepEqual(radio.picks[k], d.picks[k], k);
  assert.equal(sim.stepChoice(radio, 'radio'), 'big');
  const added = sim.applyStep(d, 'instruments', 'sounder');
  assert.ok(added.picks.instruments.includes('sounder'));
  const removed = sim.applyStep(added, 'instruments', 'sounder');
  assert.deepEqual(removed.picks.instruments, d.picks.instruments);
  assert.ok(sim.applyStep(d, 'instruments', d.picks.instruments[0]).error, 'cannot drop the last instrument');
  assert.ok(sim.applyStep(d, 'nope', 'x').error);
  assert.ok(sim.applyStep(d, 'radio', 'x').error);
  assert.ok(sim.applyStep(sim.newDesign('nile', 'engineer'), 'landing', 'heavy').error, 'no landing kit in orbit');
});

test('cards carry plain pros and cons and the numbers that matter', () => {
  for (const s of sim.scenarios()) {
    const d = sim.newDesign(s.id, 'engineer', s.requirements[0].id);
    for (const st of sim.buildSteps(s.id, 'engineer')) {
      const cards = sim.stepCards(d, st.id);
      assert.equal(cards.length, st.options.length);
      assert.equal(cards.filter((c) => c.on).length >= 1, true, `${s.id}/${st.id} one card is fitted`);
      for (const c of cards) {
        assert.ok(c.pros.length + c.cons.length <= 3, `${s.id}/${st.id}/${c.id} at most 3 lines`);
        for (const line of c.pros.concat(c.cons)) assert.ok(typeof line === 'string' && line.length > 3 && !/[{}]/.test(line), line);
        assert.ok(Object.keys(c.nums).length >= 1);
      }
      if (st.options.length > 1) assert.ok(cards.some((c) => c.pros.length + c.cons.length > 0), `${s.id}/${st.id} says something`);
    }
  }
  const mars = sim.newDesign('mars', 'engineer', 'ice');
  const rocket = sim.stepCards(mars, 'rocket');
  assert.ok(rocket.find((c) => c.id === 'light').cons.some((x) => /too heavy/.test(x)), 'the light rocket says it is too weak');
  assert.equal(rocket.find((c) => c.id === 'light').flies, false);
});

test('requirement fit follows the instruments, and changing it preserves the design', () => {
  const d = sim.newDesign('mars', 'engineer', 'ice');
  const fit = sim.requirementFit(d);
  assert.deepEqual(fit.map((f) => f.id), ['ice', 'sites']);
  for (const f of fit) assert.ok(f.fit >= 0 && f.fit <= 1 && f.title);
  const camera = sim.applyStep(d, 'instruments', 'hires');
  const fit2 = sim.requirementFit(camera);
  assert.ok(fit2[1].fit > fit[1].fit, 'a camera fits landing-site pictures better');
  const r = sim.setRequirement(d, 'sites');
  assert.equal(r.requirement, 'sites');
  assert.deepEqual(r.picks, d.picks);
  assert.ok(sim.setRequirement(d, 'nope').error);
});

// ---------- v3 (docs/TEAM-V3.md "As built (v3: build)") ----------
const DIFFS = ['cadet', 'engineer', 'director'];

test('v3 CubeSat: a training flight in low orbit with CubeSat-scale parts, a rideshare ride and GEO locked', () => {
  const s = sim.scenarios().find((x) => x.id === 'cubesat');
  assert.ok(s && s.training && !s.landing && s.cubesat);
  for (const df of DIFFS) {
    const d = sim.newDesign('cubesat', df, 'green');
    const res = sim.resources(d);
    assert.ok(res.mass.value < 24 && res.budget.value < 10, `${df}: CubeSat scale (${res.mass.value} kg, $${res.budget.value}M)`);
    const steps = sim.buildSteps('cubesat', df);
    const rocket = steps.find((x) => x.id === 'rocket');
    assert.strictEqual(rocket.title, 'Bus and ride');
    assert.deepStrictEqual(rocket.options.map((o) => o.id), ['slot6', 'slot12', 'dedicated']);
    const orbit = sim.stepCards(d, 'orbit');
    assert.ok(orbit.find((c) => c.id === 'geo').locked, 'a rideshare CubeSat cannot reach GEO');
    for (const c of sim.stepCards(d, 'instruments')) assert.ok(c.nums.massKg <= 2, `${c.id} is CubeSat-sized`);
    assert.ok(!sim.crisesFor(d, 5).some((c) => c.type === 'fuelLeak'), 'no fuel to leak');
  }
  // No engine: an ISS-orbit CubeSat flown too long falls back into the air.
  let d = sim.newDesign('cubesat', 'engineer', 'green');
  d = sim.set(d, 'planner', 'orbit', 'iss');
  d = sim.set(d, 'planner', 'lifetime', 'y2');
  assert.ok(!sim.checks(d).find((c) => c.id === 'life').ok);
  assert.strictEqual(sim.fly(d, 7).result.cause, 'drag');
  // The 12U slot lifts what the 6U slot cannot.
  let big = sim.set(sim.newDesign('cubesat', 'engineer', 'thirst'), 'scientist', 'instruments', ['cubeCam', 'cubeTir', 'cubeHyper']);
  big = sim.set(big, 'engineer', 'panels', 'wings4');
  assert.ok(sim.stepCards(big, 'rocket').find((c) => c.id === 'slot12').flies);
});

test('v3 thermal control: a step on Engineer and above, with real consequences', () => {
  for (const s of sim.scenarios()) {
    assert.ok(!sim.buildSteps(s.id, 'cadet').some((x) => x.id === 'thermal'), `${s.id}: Cadet keeps the standard system`);
    assert.ok(sim.buildSteps(s.id, 'engineer').some((x) => x.id === 'thermal' && x.role === 'engineer'), `${s.id}: Engineer chooses it`);
  }
  // Too weak on a cold world: the check fails, the flight says so and loses science.
  const std = sim.newDesign('europa', 'engineer', 'shell');
  const weak = sim.set(std, 'engineer', 'thermal', 'blanket');
  assert.ok(!sim.checks(weak).find((c) => c.id === 'thermal').ok);
  assert.ok(sim.checks(std).find((c) => c.id === 'thermal').ok, 'the standard system copes');
  const f = sim.fly(weak, 11);
  assert.ok(f.events.some((e) => e.kind === 'thermal'));
  assert.ok(f.result.science <= sim.fly(std, 11).result.science);
  assert.ok(sim.resources(weak).mass.value < sim.resources(std).mass.value, 'blankets are lighter');
  // Near Earth blankets are enough; on Venus they overheat.
  assert.ok(sim.checks(sim.set(sim.newDesign('nile', 'engineer'), 'engineer', 'thermal', 'blanket')).find((c) => c.id === 'thermal').ok);
  assert.match(sim.checks(sim.set(sim.newDesign('venus', 'engineer'), 'engineer', 'thermal', 'blanket')).find((c) => c.id === 'thermal').text, /sunlight/);
  // A design with no thermal pick flies exactly as the standard one.
  const old = JSON.parse(JSON.stringify(std));
  delete old.picks.thermal;
  assert.deepStrictEqual(sim.fly(old, 3).result, sim.fly(std, 3).result);
});

test('v3 cards: cost on every part card at every difficulty; Engineer adds specs, Flight director the point-design detail', () => {
  for (const s of sim.scenarios()) for (const df of DIFFS) {
    const d = sim.newDesign(s.id, df, s.requirements[0].id);
    const depth = sim.cml(df).depth;
    for (const st of sim.buildSteps(s.id, df)) {
      for (const c of sim.stepCards(d, st.id)) {
        if (st.id !== 'orbit' && st.id !== 'route') assert.ok(c.nums.costM != null, `${s.id}/${df}/${st.id}/${c.id} has a cost`);
        if (st.id === 'instruments') for (const k of ['massKg', 'powerW', 'dataGb', 'costM', 'sciPct']) assert.ok(c.nums[k] != null, `${s.id}/${c.id} ${k}`);
        assert.strictEqual(!!c.specs, depth >= 2, `${df} specs`);
        assert.strictEqual(!!c.detail, depth >= 3, `${df} detail`);
        if (c.specs) for (const x of c.specs) assert.ok(x.label && x.value && !/[{}]/.test(x.value), `${st.id} ${x.id}`);
        if (c.detail) for (const id of ['margin', 'trl', 'cost', 'verify']) assert.ok(c.detail.some((x) => x.id === id), `${st.id} detail ${id}`);
        if (st.id === 'instruments' && c.specs) assert.ok(c.specs.some((x) => x.id === 'cost'), 'instrument cards show the cost');
      }
    }
  }
  assert.deepStrictEqual(DIFFS.map((df) => sim.cml(df).level), ['1–2', '3', '4']);
});

test('v3 segments and traceability: every step has a segment, and every mission requirement traces to build steps', () => {
  const SEG = new Set(sim.segments().map((g) => g.id));
  assert.deepStrictEqual([...SEG], ['launch', 'space', 'ground', 'user']);
  for (const s of sim.scenarios()) {
    const d = sim.newDesign(s.id, 'director', s.requirements[0].id);
    const tr = sim.traceability(d);
    for (const f of ['need', 'goal', 'concept', 'target']) assert.ok(tr[f] && tr[f].length > 5, `${s.id} ${f}`);
    assert.strictEqual(tr.objectives.filter((o) => o.primary).length, 1);
    for (const o of tr.objectives) assert.ok(o.measure && o.measure.length > 5, `${s.id} measure ${o.id}`);
    const steps = sim.buildSteps(s.id, 'director');
    for (const st of steps) assert.ok(SEG.has(st.segment), `${s.id}/${st.id} segment`);
    for (const m of tr.missionReqs) {
      assert.match(m.id, /^MR-\d+$/);
      assert.ok(m.steps.some((id) => steps.some((st) => st.id === id)), `${s.id} ${m.id} has a step to fix it`);
      assert.ok(!/[{}]/.test(m.text), m.text);
    }
    for (const q of sim.requirementStatus(d)) assert.ok(q.proof && !/[{}]/.test(q.proof) && q.fix, `${s.id} ${q.id} proof and fix`);
    assert.strictEqual(tr.missionReqs.some((m) => m.key === 'land'), s.landing);
  }
  // The three signature missions add their own requirements.
  const keys = (id) => sim.traceability(sim.newDesign(id, 'engineer')).missionReqs.map((m) => m.key);
  assert.ok(keys('moon').includes('night'));
  assert.ok(keys('mars').includes('arrive') && keys('mars').includes('dust'));
  assert.ok(keys('cubesat').includes('box') && keys('cubesat').includes('databudget'));
  assert.ok(sim.buildSteps('mars', 'engineer').some((x) => x.id === 'route'), 'Mars chooses how to arrive');
  assert.ok(!sim.buildSteps('moon', 'engineer').some((x) => x.id === 'route'));
});

test('v3 signature crises: Moon, Mars and the CubeSat always meet their own problem', () => {
  for (const [id, type] of [['moon', 'lunarEclipse'], ['mars', 'dustStorm'], ['cubesat', 'tumble']]) {
    for (const seed of [1, 2, 3]) assert.ok(sim.crisesFor(sim.newDesign(id, 'cadet'), seed).some((c) => c.type === type), `${id} ${seed}`);
  }
  for (const id of ['nile', 'storms', 'venus', 'europa']) assert.ok(!sim.crisesFor(sim.newDesign(id, 'director'), 4).some((c) => ['lunarEclipse', 'dustStorm', 'tumble'].includes(c.type)));
  const d = sim.newDesign('mars', 'engineer', 'ice');
  const c = sim.crisesFor(d, 9).find((x) => x.type === 'dustStorm');
  assert.ok(sim.fly(d, 9, { [c.id]: 'fixed' }).result.science >= sim.fly(d, 9, { [c.id]: 'missed' }).result.science);
});

test('v3 locks: choices that cannot serve the objective are locked with a reason and never suggested', () => {
  const storms = sim.newDesign('storms', 'engineer', 'early');
  assert.ok(sim.lockOf(storms, 'orbit', 'sso600'));
  assert.equal(sim.lockOf({ ...storms, requirement: 'track' }, 'orbit', 'sso600'), null);
  const venus = sim.applyStep(sim.newDesign('venus', 'engineer', 'chem'), 'radio', 'small');
  assert.match(sim.lockOf(venus, 'instruments', 'uso').reason, /dish/);
  const nileGeo = sim.set(sim.newDesign('nile', 'engineer', 'sharp'), 'planner', 'orbit', 'geo');
  assert.ok(sim.lockOf(nileGeo, 'instruments', 'hires'));
  for (const s of sim.scenarios()) for (const df of DIFFS) {
    const d = sim.newDesign(s.id, df, s.requirements[0].id);
    const b = sim.bestChange(d, 3);
    if (b) assert.equal(sim.lockOf(d, b.step, b.option), null, `${s.id}/${df}`);
  }
});

test('v3 score: every point is traceable, and a lost or failed mission never outscores a successful one', () => {
  const seen = { full: [], partial: [], fail: [], lost: [] };
  const r = rnd(42);
  for (const s of sim.scenarios()) for (const df of DIFFS) {
    const cat = sim.catalog(s.id, df);
    for (let k = 0; k < 6; k++) {
      let d = sim.newDesign(s.id, df, s.requirements[0].id);
      for (const [role, groups] of Object.entries(cat.roles)) for (const g of groups) {
        if (g.multi || r() < 0.5) continue;
        const n = sim.set(d, role, g.key, g.options[Math.floor(r() * g.options.length)].id);
        if (!n.error) d = n;
      }
      const seed = 100 + k;
      const outcomes = Object.fromEntries(sim.crisesFor(d, seed).map((c) => [c.id, r() < 0.5 ? 'fixed' : 'missed']));
      const f = sim.fly(d, seed, outcomes);
      const sc = sim.score(d, f, { requestsSent: 2, requestsAnswered: 1 });
      assert.equal(sc.total, sc.requirements + sc.science + sc.efficiency + sc.teamwork + sc.outcome.adjust);
      for (const ax of Object.values(sc.axes)) for (const it of ax.items) assert.ok(it.label && Number.isInteger(it.points));
      seen[sc.outcome.id].push(sc.total);
    }
  }
  for (const w of WINNERS.slice(0, 40)) {
    const d = asDesign(w);
    const sc = sim.score(d, sim.fly(d, 11, allFixed(d, 11)));
    seen[sc.outcome.id].push(sc.total);
  }
  const max = (a) => (a.length ? Math.max(...a) : -1);
  const min = (a) => (a.length ? Math.min(...a) : 2000);
  assert.ok(max(seen.lost) < min(seen.partial) && max(seen.lost) < min(seen.full), 'lost < success');
  assert.ok(max(seen.fail) < min(seen.partial), 'failed < partial');
  assert.ok(max(seen.partial) < min(seen.full), 'partial < full');
  assert.ok(seen.lost.length && seen.full.length && seen.partial.length, JSON.stringify(Object.fromEntries(Object.entries(seen).map(([k, v]) => [k, v.length]))));
});

test('v3 AI crewmates: they pick sensible, flyable parts with a reason, and answer suggestions', () => {
  for (const [id, mine] of [['mars', 'planner'], ['moon', 'scientist'], ['cubesat', 'comms'], ['europa', 'engineer']]) {
    const d = sim.newDesign(id, 'engineer', sim.scenarios().find((x) => x.id === id).requirements[0].id);
    const steps = sim.buildSteps(id, 'engineer').filter((st) => st.role !== mine).map((st) => st.id);
    const plan = sim.crewPlan(d, steps);
    if (steps.includes('rocket')) assert.ok(!sim.checks(plan.design).some((c) => c.hard && !c.ok), `${id}: the crew's ship can launch`);
    for (const st of steps) assert.ok(plan.picks[st] && plan.picks[st].line.length > 8 && !/[{}]/.test(plan.picks[st].line), `${id}/${st} line`);
  }
  const d = sim.newDesign('storms', 'engineer', 'early');
  const no = sim.crewReview(d, 'orbit', 'sso600');
  assert.strictEqual(no.ok, false);
  assert.match(no.line, /early warning/);
  const yes = sim.crewReview(d, 'batteries', sim.stepCards(d, 'batteries').find((c) => !c.on).id);
  assert.ok(typeof yes.ok === 'boolean' && yes.line.length > 5);
});
