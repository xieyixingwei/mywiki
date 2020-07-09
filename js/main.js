(function($) {

'use strict';

/**
 * main.js
 */

var publicMethods = {};
$.md.publicMethods = $.extend ({}, $.md.publicMethods, publicMethods);

$.md.stages = new $.Stages(['init', 'loadmarkdown', 'transform', 'show']);

$.md.stages.stage('init').subscribe( function( done ) {
    $('#md-all').empty();
    var skel = `<div id="md-body">
                    <div id="md-title"></div>
                    <div id="md-menu"></div>
                    <div id="md-content"></div>
                </div>`;
    $('#md-all').prepend($(skel));
    done();
} ).subscribe( function( done ) {
    $.ajax( {
        url: './config.json',
        dataType: 'text'
    } ).done( function( data ) {
        try {
            var data_json = JSON.parse(data);
            $.md.config = $.extend($.md.config, data_json);
            console.log('Found a valid config.json file, using configuration');
        } catch(err) {
            console.log('config.json was not JSON parsable: ' + err);
        }
    } ).fail( function( err, textStatus ) {
        console.log('unable to retrieve config.json: ' + textStatus);
    } ).always( function() {
        done();
    } );
} );

$.md.stages.stage('loadmarkdown').subscribe( function( done ) {
    $.ajax( {
        url: $.md.mainHref,
        dataType: 'text'
    } ).done( function( data ) {
        $.md.mdText = data;
        console.log('Get ' + $.md.mainHref);
    } ).fail( function() {
        console.log('Could not get ' + $.md.mainHref);
    } ).always( function() {
        done();
    } );
} );

$.md.stages.stage('transform').subscribe( function( done ) {

    $.md.htmlText = $.md.marked($.md.mdText);

    loadExternalIncludes($.md.htmlText).always( function() {
        done();
    } );
} );

$.md.stages.stage('show').subscribe( function( done ) {
    $.md.htmlText = $.md.tableOfContents($.md.htmlText);
    $('#md-content').html($.md.htmlText);
    $('html').removeClass('md-hidden-load');
    $.md.tableOfContents.scrollToInPageAnchor($.md.inPageAnchor);
    done();
});

// load [include](/foo/bar.md) external links
function loadExternalIncludes() {
    var $mdHtml = $(`<div>${$.md.htmlText}</div>`);

    function findExternalIncludes ($html) {
        return $html.find('a').filter (function () {
            var href = $(this).attr('href');
            var text = $(this).toptext();
            var isMarkdown = $.md.util.hasMarkdownFileExtension(href);
            var isInclude = text === 'include';
            return isInclude && isMarkdown;
        });
    }

    var includeLinks = findExternalIncludes ($mdHtml);
    var dfd = $.DeferredCount(includeLinks.length);

    includeLinks.each( function( i, e ) {
        var $el = $(e);
        var href = $el.attr('href');
        var text = $el.toptext();

        $.ajax( {
            url: href,
            dataType: 'text'
        } ).done( function( data ) {
            var $html = $($.md.marked(data));
            $html.insertAfter($el);
            $el.remove();
            $.md.htmlText = $mdHtml.html();
            var includes = findExternalIncludes($mdHtml);
            if ( includes.length > 0 ) {
                dfd.countUp();
                loadExternalIncludes().always( function() {
                    dfd.countDown();
                } );
            }
        } ).always( function() {
            dfd.countDown();
        } );
    });

    return dfd;
}

function extractHashData() {
    // first char is the # or #!
    var href;
    if (window.location.hash.startsWith('#!')) {
        href = window.location.hash.substring(2);
    } else {
        href = window.location.hash.substring(1);
    }
    href = decodeURIComponent(href);
    // extract possible in-page anchor
    let ex_pos = href.indexOf('#');
    if (ex_pos !== -1) {
        $.md.inPageAnchor = href.substring(ex_pos + 1);
        $.md.mainHref = href.substring(0, ex_pos);
    } else {
        $.md.inPageAnchor = '';
        $.md.mainHref = href;
    }

    ex_pos = $.md.mainHref.lastIndexOf('/');
    if(ex_pos === -1)
        $.md.href = '';
    else
        $.md.href = $.md.mainHref.substring(0, ex_pos + 1);

    let len = window.location.href.indexOf('#!');
    $.md.baseUrl = window.location.href.substring(0, len);
    len = $.md.baseUrl.lastIndexOf('/');
    $.md.basePath = $.md.baseUrl.substring(0, len + 1);
    console.log('href: ' + $.md.href);
    console.log('base url: ' + $.md.baseUrl);
    console.log('main page: ' + $.md.mainHref);
}

function appendDefaultFilenameToHash () {
    var newHashString = '';
    var currentHashString = window.location.hash || '';
    if (currentHashString === '' ||
        currentHashString === '#'||
        currentHashString === '#!')
    {
        newHashString = '#!index.md';
    }
    else if (currentHashString.startsWith ('#!') &&
                currentHashString.endsWith('/')
            ) {
        newHashString = currentHashString + 'index.md';
    }
    if (newHashString)
        window.location.hash = newHashString;
}

$(document).ready(function () {
    appendDefaultFilenameToHash();
    extractHashData();

    $(window).bind('hashchange', function () {
        window.location.reload(false);
    });

    $.md.stages.run().done( function() {
        console.log('all done');
    } );
} );

} ( jQuery ) );